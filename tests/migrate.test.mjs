import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, exists, install, makeRepo, manifestOf, planId, read, removeAll, snapshot } from './helpers.mjs'

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex')
const OLD = 'docs/decisions'
const START = '<!-- abmh:start -->'
const END = '<!-- abmh:end -->'

function oldInstall(dir) {
  install(dir, ['--profile', 'abm-estricto'])
  fs.mkdirSync(path.join(dir, 'docs'))
  fs.renameSync(path.join(dir, '00-docs/decisions'), path.join(dir, OLD))
  fs.rmSync(path.join(dir, '00-docs'), { recursive: true })
  fs.rmSync(path.join(dir, '.abmh/harness.yaml'))
  const manifest = manifestOf(dir)
  manifest.entries = manifest.entries
    .filter((entry) => entry.path !== '.abmh/harness.yaml' && !/^00-docs\/[^/]+\.md$/.test(entry.path))
    .map((entry) => (entry.path.startsWith('00-docs') ? { ...entry, path: entry.path.replace('00-docs/decisions', OLD).replace('00-docs', 'docs') } : entry))
  delete manifest.options.profile
  delete manifest.options.docsDir
  delete manifest.options.docsLayout
  for (const file of ['AGENTS.md', 'GEMINI.md']) {
    const text = read(dir, file).replace('`00-docs/decisions/`', '`docs/decisions/`')
    fs.writeFileSync(path.join(dir, file), text)
    manifest.entries.find((entry) => entry.kind === 'block' && entry.path === file).sha256 = sha(text.slice(text.indexOf(START), text.indexOf(END) + END.length))
  }
  fs.writeFileSync(path.join(dir, '.abmh/manifest.json'), JSON.stringify(manifest))
}

const updateAll = (dir) => abmh(dir, ['update', '--accept-plan', planId(abmh(dir, ['update']).out)])

test('update on a SPEC-007 install creates the new folder and removes only untouched old files', () => {
  const dir = makeRepo({ 'keep.txt': 'x' })
  const before = snapshot(dir)
  oldInstall(dir)
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /create-file 00-docs\/decisions\/ \(2 files\)/)
  assert.match(plan.out, /create-file \.abmh\/harness\.yaml/)
  assert.match(plan.out, /delete-file docs\/decisions\/ \(2 files\)/)
  assert.match(plan.out, /retire-dir docs\/decisions/)
  assert.equal(abmh(dir, ['update', '--accept-plan', planId(plan.out)]).code, 0)
  assert.equal(exists(dir, 'docs'), false)
  assert.ok(exists(dir, '00-docs/decisions/README.md'))
  assert.match(read(dir, '.abmh/harness.yaml'), /profile: abm-estricto\ndocsDir: 00-docs\n/)
  assert.match(read(dir, 'AGENTS.md'), /`00-docs\/decisions\/`/)
  assert.match(abmh(dir, ['update']).out, /already up to date/)
  assert.equal(removeAll(dir).code, 0)
  assert.deepEqual(snapshot(dir), before)
})

test('files the human wrote or edited in the old folder are never moved or deleted and are listed', () => {
  const dir = makeRepo()
  oldInstall(dir)
  fs.writeFileSync(path.join(dir, OLD, 'ADR-001-mine.md'), '# mine\n')
  fs.appendFileSync(path.join(dir, OLD, 'README.md'), '\nmy note\n')
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /skip docs\/decisions\/ADR-001-mine.md - stays where it is, not moved/)
  assert.match(plan.out, /forget docs\/decisions\/README.md - .*edited/)
  assert.equal(abmh(dir, ['update', '--accept-plan', planId(plan.out)]).code, 0)
  assert.equal(read(dir, `${OLD}/ADR-001-mine.md`), '# mine\n')
  assert.match(read(dir, `${OLD}/README.md`), /my note/)
  assert.equal(exists(dir, `${OLD}/TEMPLATE.md`), false)
  assert.ok(exists(dir, '00-docs/decisions/TEMPLATE.md'))
  assert.match(abmh(dir, ['update']).out, /already up to date/)
  assert.equal(removeAll(dir).code, 0)
  assert.equal(read(dir, `${OLD}/ADR-001-mine.md`), '# mine\n')
  assert.equal(exists(dir, '00-docs'), false)
})

test('update never retires a folder that is still wanted', () => {
  const dir = makeRepo()
  install(dir)
  assert.match(abmh(dir, ['update']).out, /already up to date/)
  assert.ok(exists(dir, '.claude/skills/spec'))
})

test('user files in a parent of the old folder keep the parent in place', () => {
  const dir = makeRepo()
  oldInstall(dir)
  fs.writeFileSync(path.join(dir, 'docs/other.md'), 'x')
  assert.equal(updateAll(dir).code, 0)
  assert.equal(read(dir, 'docs/other.md'), 'x')
  assert.equal(exists(dir, OLD), false)
})

test('an old install without a profile keeps every template it already has', () => {
  const dir = makeRepo()
  oldInstall(dir)
  const plan = abmh(dir, ['update'])
  assert.doesNotMatch(plan.out, /delete-file \.abmh\/core/)
})

test('an interrupted update resumes with the original plan and ends complete', () => {
  const dir = makeRepo()
  install(dir)
  const plan = abmh(dir, ['update', '--docs-dir', 'adr'])
  const crashed = abmh(dir, ['update', '--docs-dir', 'adr', '--accept-plan', planId(plan.out)], {
    beforeAction: (index) => {
      if (index === 3) throw new Error('killed')
    },
  })
  assert.equal(crashed.code, 5)
  assert.equal(manifestOf(dir).status, 'pending')
  const info = abmh(dir, ['update'])
  assert.match(info.out, new RegExp(planId(plan.out)))
  assert.equal(abmh(dir, ['update', '--accept-plan', planId(plan.out)]).code, 0)
  assert.equal(manifestOf(dir).status, 'complete')
  assert.ok(exists(dir, 'adr/decisions/README.md'))
  assert.equal(exists(dir, '00-docs'), false)
  assert.match(abmh(dir, ['update']).out, /already up to date/)
})

test('a docs folder name that differs only by letter case is refused', () => {
  const dir = makeRepo()
  install(dir, ['--docs-dir', 'adr'])
  const result = abmh(dir, ['update', '--docs-dir', 'ADR'])
  assert.equal(result.code, 2)
  assert.match(result.err, /only by letter case/)
  assert.ok(exists(dir, 'adr/decisions/README.md'))
})

test('docs folder names with odd characters are refused', () => {
  const dir = makeRepo()
  for (const value of ['a\nb', 'a`b', 'a b', '.ABMH/x', 'C:x', '$(x)']) assert.equal(abmh(dir, ['init', '--docs-dir', value]).code, 2, JSON.stringify(value))
})

test('a stale tracked file that is already gone is forgotten once', () => {
  const dir = makeRepo()
  install(dir)
  const manifest = manifestOf(dir)
  manifest.entries.push({ kind: 'file', path: 'old/gone.md', sha256: 'a'.repeat(64), mode: 420, createdByInstaller: true })
  fs.writeFileSync(path.join(dir, '.abmh/manifest.json'), JSON.stringify(manifest))
  assert.equal(updateAll(dir).code, 0)
  assert.equal(manifestOf(dir).entries.some((entry) => entry.path === 'old/gone.md'), false)
  assert.match(abmh(dir, ['update']).out, /already up to date/)
})
