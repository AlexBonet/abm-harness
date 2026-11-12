import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { write } from './checkhelpers.mjs'
import { abmh, exists, install, makeRepo, read, removeAll, snapshot } from './helpers.mjs'

const check = (dir, gate = 'prueba') => {
  const result = spawnSync('sh', ['.abmh/checks/check.sh', gate], { cwd: dir, encoding: 'utf8' })
  return { code: result.status, out: `${result.stdout}${result.stderr}` }
}

test('a fresh install passes its own Prueba gate in both profiles, with NOT RUN where nothing can be judged yet', () => {
  for (const profile of ['universal', 'abm-estricto']) {
    const dir = makeRepo({ 'build.gradle.kts': '' })
    assert.equal(install(dir, ['--profile', profile]).code, 0)
    const result = check(dir)
    assert.equal(result.code, 0, `${profile}: ${result.out}`)
    assert.match(result.out, /PASS COD-02/)
    assert.match(result.out, /PASS COD-08/)
    assert.match(result.out, /PASS COM-01/)
    assert.match(result.out, /PASS COM-03/)
    assert.match(result.out, /NOT RUN COD-01/)
    assert.match(result.out, /NOT RUN COM-04/)
    assert.doesNotMatch(result.out, /FAIL/)
    assert.equal(/COD-09/.test(result.out), profile === 'abm-estricto')
  }
})

test('a project without a stack reports NOT RUN for the stack checks instead of passing them', () => {
  const dir = makeRepo({ 'README.md': 'x' })
  install(dir)
  const result = check(dir)
  assert.equal(result.code, 0)
  assert.match(result.out, /NOT RUN COD-02 [^\n]*\n\s+no stack installed \(stack pending\)/)
})

test('an installed project fails its gate on a comment and names the file and line', () => {
  const dir = makeRepo({ 'build.gradle.kts': '' })
  install(dir)
  write(dir, 'app/A.kt', 'class A {\n    // note\n}\n')
  const result = check(dir)
  assert.equal(result.code, 1)
  assert.match(result.out, /FAIL COD-03 No code comments[^\n]*\n\s+app\/A\.kt:2 code comment/)
})

test('remove puts the tree back as it was, packs and checks included', () => {
  const dir = makeRepo({ 'build.gradle.kts': '', 'README.md': 'x' })
  const before = snapshot(dir)
  install(dir, ['--profile', 'abm-estricto'])
  assert.equal(exists(dir, '.abmh/checks/check.sh'), true)
  assert.equal(removeAll(dir).code, 0)
  assert.deepEqual(snapshot(dir), before)
})

const MIGRATION = '-- spec: SPEC-1\n-- local-test: yes\n-- backup: dump\n-- rollback: drop table t;\ncreate table t (id int);\n'

test('a project with migrations passes Prueba and Seguridad after init in both profiles, then fails on a leaked key', () => {
  for (const profile of ['universal', 'abm-estricto']) {
    const dir = makeRepo({ 'supabase/migrations/001_a.sql': MIGRATION })
    assert.equal(install(dir, ['--profile', profile]).code, 0)
    write(dir, '00-docs/data/MIGRATIONS.md', 'Audience: both\n\n> **Summary:** registry.\n\n001_a.sql\n')
    const prueba = check(dir)
    assert.match(prueba.out, /PASS MIG-01/)
    assert.match(prueba.out, /PASS MIG-02/)
    assert.match(prueba.out, /PASS MIG-03/)
    assert.doesNotMatch(prueba.out, /FAIL/)
    const security = check(dir, 'seguridad')
    assert.equal(security.code, 0, security.out)
    assert.match(security.out, /PASS SEC-01/)
    assert.match(security.out, /PASS SEC-02/)
    assert.match(security.out, /PASS MIG-04/)
    write(dir, 'src/k.ts', `const k = '${['gh', 'p_', 'AbCdEfGh1234567890'.repeat(3)].join('')}'\n`)
    assert.equal(check(dir, 'seguridad').code, 1)
  }
})

test('update keeps an edited data pack and remove restores the tree', () => {
  const dir = makeRepo({ 'migrations/001_a.sql': MIGRATION })
  const before = snapshot(dir)
  install(dir)
  write(dir, '.abmh/packs/data.md', 'mine\n')
  assert.equal(removeAll(dir).code, 0)
  assert.equal(exists(dir, '.abmh/packs/data.md'), true)
  assert.equal(exists(dir, '.abmh/packs/security.md'), false)
  assert.equal(exists(dir, '00-docs/ROTATION.md'), false)
  assert.equal(snapshot(dir).tree.filter((line) => !line.includes('.abmh')).join('\n'), before.tree.join('\n'))
})

const RELEASE = 'Touches: the page\nCould break: login\nRollback: revert\nPost-check: open the site\n'
const RECOVERY = 'Contain: flag off\nCheck health: status page\nRestore: redeploy\n'

test('a fresh install in both profiles keeps Prueba and Seguridad green and shows Despliegue honestly, then passes once filled', () => {
  for (const profile of ['universal', 'abm-estricto']) {
    const dir = makeRepo({ 'package.json': '{"dependencies":{"react":"1"}}' })
    assert.equal(install(dir, ['--profile', profile, '--ci']).code, 0)
    assert.equal(check(dir, 'prueba').code, 0)
    assert.equal(check(dir, 'seguridad').code, 0)
    const fresh = check(dir, 'despliegue')
    assert.equal(fresh.code, 1)
    assert.match(fresh.out, /PASS DEP-01/)
    assert.match(fresh.out, /FAIL DEP-02/)
    assert.match(fresh.out, /FAIL DEP-03/)
    assert.match(fresh.out, /NOT RUN DEP-04/)
    write(dir, '00-docs/RELEASE.md', RELEASE)
    write(dir, '00-docs/RECOVERY.md', RECOVERY)
    write(dir, '.abmh/harness.yaml', `${read(dir, '.abmh/harness.yaml')}web: true\nstaging: s\ndesign_check: exit 0\n`)
    assert.equal(check(dir, 'despliegue').code, 0)
    const design = check(dir, 'diseño')
    assert.match(design.out, /FAIL DSN-01/)
    assert.match(design.out, /PASS DSN-02/)
    write(dir, 'DESIGN.md', '# d\n')
    assert.equal(check(dir, 'design').code, 0)
  }
})

test('design and seo packs stay out without an interface or a request, and remove restores the tree with every pack in', () => {
  const plain = makeRepo({ 'README.md': 'x' })
  install(plain)
  assert.match(check(plain, 'design').out, /no rules for gate diseño/)
  assert.match(check(plain, 'seo').out, /no rules for gate seo/)
  for (const profile of ['universal', 'abm-estricto']) {
    const dir = makeRepo({ 'package.json': '{"dependencies":{"react":"1"}}', 'README.md': 'x' })
    const before = snapshot(dir)
    install(dir, ['--profile', profile, '--packs', 'seo', '--ci'])
    for (const rel of ['.abmh/packs/deploy.md', '.abmh/packs/design.md', '.abmh/packs/seo.md', '.github/workflows/abmh-ci.yml', '00-docs/RELEASE.md', '00-docs/RECOVERY.md']) assert.equal(exists(dir, rel), true, rel)
    assert.equal(removeAll(dir).code, 0)
    assert.deepEqual(snapshot(dir).tree, before.tree)
  }
})

test('update keeps an edited deploy pack and an edited RELEASE.md, and remove leaves them', () => {
  const dir = makeRepo({ 'README.md': 'x' })
  install(dir)
  write(dir, '.abmh/packs/deploy.md', 'mine\n')
  write(dir, '00-docs/RELEASE.md', RELEASE)
  const update = abmh(dir, ['update'])
  assert.match(update.out, /skip \.abmh\/packs\/deploy\.md - edited by hand, kept/)
  assert.match(update.out, /skip 00-docs\/RELEASE\.md - edited by hand, kept/)
  assert.equal(removeAll(dir).code, 0)
  assert.equal(read(dir, '.abmh/packs/deploy.md'), 'mine\n')
  assert.equal(read(dir, '00-docs/RELEASE.md'), RELEASE)
})
