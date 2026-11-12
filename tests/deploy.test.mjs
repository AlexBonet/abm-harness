import assert from 'node:assert/strict'
import { test } from 'node:test'
import { project, sh, write } from './checkhelpers.mjs'
import { abmh, exists, install, makeRepo, planId, read, removeAll, snapshot } from './helpers.mjs'

const WORKFLOW = 'jobs:\n  ci:\n    steps:\n      - run: pnpm lint\n      - run: pnpm typecheck\n      - run: pnpm test\n      - run: sh scripts/verify.sh\n'
const FILLED = 'Audience: both\nTouches: the login page\nCould break: sessions\nRollback: revert the commit\nPost-check: open the site\n'
const RECOVERY = 'Audience: both\nContain: turn the feature flag off\nCheck health: open the status page\nRestore: redeploy the last good build\n'

const dep = (files = {}, yaml = '') => {
  const dir = project({ files })
  write(dir, '.abmh/harness.yaml', `version: x\nprofile: universal\ndocsDir: 00-docs\n${yaml}`)
  return dir
}

test('DEP-01 passes a workflow that runs lint, types, tests and verify.sh', () => {
  assert.equal(sh(dep({ '.github/workflows/ci.yml': WORKFLOW }), 'dep-01.sh').code, 0)
  assert.equal(sh(dep({ '.github/workflows/ci.yaml': WORKFLOW }), 'dep-01.sh').code, 0)
})

for (const [missing, word] of [['lint', 'lint'], ['types', 'typecheck'], ['tests', 'test'], ['verify.sh', 'verify.sh']]) {
  test(`DEP-01 fails and names ${missing} when the workflow does not run it`, () => {
    const text = WORKFLOW.split('\n').filter((line) => !line.includes(word)).join('\n')
    const result = sh(dep({ '.github/workflows/ci.yml': text }), 'dep-01.sh')
    assert.equal(result.code, 1)
    assert.match(result.out, new RegExp(`missing: ${missing.replace('.', '\\.')}`))
  })
}

test('DEP-01 fails without a workflow and ignores comments and name lines', () => {
  const none = sh(dep({ 'README.md': 'x' }), 'dep-01.sh')
  assert.equal(none.code, 1)
  assert.match(none.out, /no workflow/)
  const text = '# lint typecheck test verify.sh\nname: lint typecheck test verify.sh\njobs:\n  ci:\n    steps:\n      - run: echo hi\n'
  assert.equal(sh(dep({ '.github/workflows/ci.yml': text }), 'dep-01.sh').code, 1)
})

test('DEP-02 passes a filled checklist and fails on a placeholder, a missing label or a missing file', () => {
  assert.equal(sh(dep({ '00-docs/RELEASE.md': FILLED }), 'dep-02.sh').code, 0)
  assert.equal(sh(dep({ '00-docs/RELEASE.md': `${FILLED}`.replace('Rollback: revert the commit', 'Rollback: <how to go back>') }), 'dep-02.sh').code, 1)
  const blank = sh(dep({ '00-docs/RELEASE.md': FILLED.replace('Post-check: open the site', 'Post-check:') }), 'dep-02.sh')
  assert.equal(blank.code, 1)
  assert.match(blank.out, /Post-check/)
  assert.equal(sh(dep({ '00-docs/RELEASE.md': 'Audience: both\nTouches: x\n' }), 'dep-02.sh').code, 1)
  const missing = sh(dep({ '00-docs/STATUS.md': 'x' }), 'dep-02.sh')
  assert.equal(missing.code, 1)
  assert.match(missing.out, /RELEASE\.md is missing/)
})

test('DEP-02 and DEP-03 are NOT RUN without a docs folder', () => {
  assert.equal(sh(dep(), 'dep-02.sh').code, 2)
  assert.equal(sh(dep(), 'dep-03.sh').code, 2)
})

test('DEP-02 accepts bold labels and list bullets', () => {
  const text = '- **Touches:** the login page\n- **Could break:** sessions\n- **Rollback:** revert\n- **Post-check:** open the site\n'
  assert.equal(sh(dep({ '00-docs/RELEASE.md': text }), 'dep-02.sh').code, 0)
})

test('DEP-03 passes a filled recovery doc and fails on a placeholder or a missing file', () => {
  assert.equal(sh(dep({ '00-docs/RECOVERY.md': RECOVERY }), 'dep-03.sh').code, 0)
  const result = sh(dep({ '00-docs/RECOVERY.md': RECOVERY.replace('Restore: redeploy the last good build', 'Restore: <steps>') }), 'dep-03.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /Restore/)
  assert.match(sh(dep({ '00-docs/STATUS.md': 'x' }), 'dep-03.sh').out, /RECOVERY\.md is missing/)
})

test('DEP-04 needs staging for a web project and is NOT RUN when web is not declared', () => {
  assert.equal(sh(dep({}, 'web: true\nstaging: https://staging.example.com\n'), 'dep-04.sh').code, 0)
  const missing = sh(dep({}, 'web: true\n'), 'dep-04.sh')
  assert.equal(missing.code, 1)
  assert.match(missing.out, /staging/)
  assert.equal(sh(dep({}, 'web: true\nstaging:\n'), 'dep-04.sh').code, 1)
  const none = sh(dep(), 'dep-04.sh')
  assert.equal(none.code, 2)
  assert.match(none.out, /web: true/)
  assert.equal(sh(dep({}, 'web: false\n'), 'dep-04.sh').code, 2)
})

test('check.sh despliegue and deploy run the DEP rules from the pack table', () => {
  const dir = dep({ '.github/workflows/ci.yml': WORKFLOW, '00-docs/RELEASE.md': FILLED, '00-docs/RECOVERY.md': RECOVERY }, 'web: true\nstaging: s\n')
  for (const gate of ['despliegue', 'deploy', 'Despliegue']) {
    const result = sh(dir, 'check.sh', [gate])
    assert.equal(result.code, 0, result.out)
    for (const id of ['DEP-01', 'DEP-02', 'DEP-03', 'DEP-04']) assert.match(result.out, new RegExp(`PASS ${id}`))
  }
  write(dir, '00-docs/RELEASE.md', 'Audience: both\n')
  assert.equal(sh(dir, 'check.sh', ['deploy']).code, 1)
})

test('init creates RELEASE.md and RECOVERY.md unfilled in both languages, so DEP-02 and DEP-03 fail until a person fills them', () => {
  for (const [lang, summary] of [['en', /^> \*\*Summary:\*\*/m], ['es', /^> \*\*Resumen:\*\*/m]]) {
    const dir = makeRepo({ 'README.md': 'x\n' })
    install(dir, ['--lang', lang])
    for (const [name, labels] of [['RELEASE', ['Touches:', 'Could break:', 'Rollback:', 'Post-check:']], ['RECOVERY', ['Contain:', 'Check health:', 'Restore:']]]) {
      const text = read(dir, `00-docs/${name}.md`)
      assert.match(text, /^Audience: both$/m)
      assert.match(text, summary)
      for (const label of labels) assert.match(text, new RegExp(`^${label} <`, 'm'))
    }
    assert.equal(sh(dir, 'dep-02.sh').code, 1)
    assert.equal(sh(dir, 'dep-03.sh').code, 1)
    assert.equal(sh(dir, 'dep-04.sh').code, 2)
  }
})

test('init only notes the CI template unless --ci is given, and the note disappears when a workflow exists', () => {
  for (const profile of ['universal', 'abm-estricto']) {
    const dir = makeRepo({ 'README.md': 'x\n' })
    const plan = abmh(dir, ['init', '--profile', profile])
    assert.match(plan.out, /\[ci\]\n\s+note \.github\/workflows\/abmh-ci\.yml - .*--ci/)
    assert.doesNotMatch(abmh(dir, ['init', '--profile', profile, '--ci']).out, /available/)
    install(dir, ['--profile', profile])
    assert.equal(exists(dir, '.github/workflows/abmh-ci.yml'), false)
  }
  const has = makeRepo({ '.github/workflows/build.yml': WORKFLOW })
  assert.doesNotMatch(abmh(has, ['init']).out, /\[ci\]/)
})

test('init --ci writes the workflow template, DEP-01 passes on it, and remove puts the tree back', () => {
  for (const profile of ['universal', 'abm-estricto']) {
    const dir = makeRepo({ 'README.md': 'x\n' })
    const before = snapshot(dir)
    const plan = abmh(dir, ['init', '--profile', profile, '--ci'])
    assert.match(plan.out, /\[ci\]\n\s+create-file \.github\/workflows\/ \(1 file\)/)
    assert.match(plan.out, /--ci/)
    assert.equal(abmh(dir, ['init', '--profile', profile, '--ci', '--accept-plan', planId(plan.out)]).code, 0)
    assert.equal(exists(dir, '.github/workflows/abmh-ci.yml'), true)
    assert.equal(sh(dir, 'dep-01.sh').code, 0)
    assert.equal(removeAll(dir).code, 0)
    assert.deepEqual(snapshot(dir).tree.filter((line) => !line.includes('.abmh')), before.tree)
  }
})

test('an accept command without --ci does not match a plan made with it, and --ci only applies to init', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  const plan = abmh(dir, ['init', '--ci'])
  assert.equal(abmh(dir, ['init', '--accept-plan', planId(plan.out)]).code, 3)
  install(dir)
  const update = abmh(dir, ['update', '--ci'])
  assert.equal(update.code, 2)
  assert.match(update.err, /--ci only applies to init/)
})

test('init --ci keeps a workflow file that already has that name', () => {
  const dir = makeRepo({ '.github/workflows/abmh-ci.yml': 'mine\n' })
  const plan = abmh(dir, ['init', '--ci'])
  assert.match(plan.out, /abmh-ci\.yml - exists, not installed by abm-harness/)
  install(dir, ['--ci'])
  assert.equal(read(dir, '.github/workflows/abmh-ci.yml'), 'mine\n')
})

test('DEP-01 does not count runs-on, job keys, trailing comments or name lines as running the step', () => {
  const only = (extra) => `jobs:\n  ci:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi # ${extra}\n`
  const none = sh(dep({ '.github/workflows/ci.yml': only('lint typecheck test verify.sh') }), 'dep-01.sh')
  assert.equal(none.code, 1)
  for (const item of ['lint', 'types', 'tests', 'verify.sh']) assert.match(none.out, new RegExp(`missing: ${item.replace('.', '\\.')}`))
  const key = sh(dep({ '.github/workflows/ci.yml': 'jobs:\n  lint:\n    steps:\n      - run: echo hi\n' }), 'dep-01.sh')
  assert.match(key.out, /missing: lint/)
})

test('DEP-01 accepts common runners and script names such as test:unit, eslint and vitest', () => {
  const text = 'jobs:\n  ci:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pnpm eslint .\n      - run: pnpm astro check\n      - run: pnpm run test:unit\n      - run: |\n          sh scripts/verify.sh\n'
  assert.equal(sh(dep({ '.github/workflows/ci.yml': text }), 'dep-01.sh').code, 0)
})

test('DEP-02 and DEP-03 fail on empty fields in a file with CRLF line endings', () => {
  const release = '**Touches:**\r\n**Could break:** \r\n**Rollback:**\r\n**Post-check:**\r\n'
  assert.equal(sh(dep({ '00-docs/RELEASE.md': release }), 'dep-02.sh').code, 1)
  assert.equal(sh(dep({ '00-docs/RECOVERY.md': 'Contain:\r\nCheck health:\r\nRestore:\r\n' }), 'dep-03.sh').code, 1)
  assert.equal(sh(dep({ '00-docs/RELEASE.md': FILLED.replaceAll('\n', '\r\n') }), 'dep-02.sh').code, 0)
})

test('harness.yaml values may have trailing spaces, quotes, CRLF and trailing comments', () => {
  for (const yaml of ['web: true \nstaging: s\n', 'web: "true"\nstaging: "s"\n', "web: 'true'\nstaging: s\n", 'web: true\r\nstaging: s\r\n', 'web: true # site\nstaging: s\n']) {
    assert.equal(sh(dep({}, yaml), 'dep-04.sh').code, 0, yaml)
  }
  assert.equal(sh(dep({}, 'web: true\nstaging: # todo\n'), 'dep-04.sh').code, 1)
})

test('update after init --ci keeps the workflow file and its folders', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir, ['--ci'])
  assert.match(abmh(dir, ['update']).out, /already up to date/)
  assert.equal(exists(dir, '.github/workflows/abmh-ci.yml'), true)
  write(dir, '.github/workflows/abmh-ci.yml', 'mine\n')
  assert.match(abmh(dir, ['update']).out, /abmh-ci\.yml - edited by hand, kept/)
})
