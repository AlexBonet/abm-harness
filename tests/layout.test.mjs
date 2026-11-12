import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, exists, install, makeRepo, manifestOf, planId, read } from './helpers.mjs'

function asLegacy(dir, docsDir) {
  const manifest = manifestOf(dir)
  delete manifest.options.docsLayout
  manifest.options.docsDir = docsDir
  fs.writeFileSync(path.join(dir, '.abmh/manifest.json'), JSON.stringify(manifest))
}

test('init stores docsLayout 2 in the manifest options only, not in harness.yaml', () => {
  const dir = makeRepo()
  install(dir)
  assert.equal(manifestOf(dir).options.docsLayout, 2)
  assert.doesNotMatch(read(dir, '.abmh/harness.yaml'), /docsLayout/)
})

test('the block names the docs root and the decisions folder', () => {
  const dir = makeRepo()
  install(dir)
  assert.match(read(dir, 'AGENTS.md'), /Project docs live in `00-docs\/` \(start with `LEEME.md`\)/)
  assert.match(read(dir, 'AGENTS.md'), /Record decisions in `00-docs\/decisions\/`/)
})

test('update on a legacy install with a nested decisions folder uses its parent as the new root', () => {
  const dir = makeRepo()
  install(dir, ['--docs-dir', 'notes/why'])
  asLegacy(dir, 'notes/why')
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /create-file notes\/decisions\/ \(2 files\)/)
  assert.equal(abmh(dir, ['update', '--accept-plan', planId(plan.out)]).code, 0)
  assert.match(read(dir, '.abmh/harness.yaml'), /docsDir: notes\n/)
  assert.equal(manifestOf(dir).options.docsLayout, 2)
  assert.ok(exists(dir, 'notes/decisions/README.md'))
})

test('update on a legacy install whose decisions folder has no parent is refused and writes nothing', () => {
  const dir = makeRepo()
  install(dir, ['--docs-dir', 'adr'])
  asLegacy(dir, 'adr')
  const before = read(dir, '.abmh/manifest.json')
  const result = abmh(dir, ['update'])
  assert.equal(result.code, 4)
  assert.match(result.err, /remove and init again/)
  assert.equal(read(dir, '.abmh/manifest.json'), before)
})

test('a project whose 00-docs was filled by a migration gets no foreign-files warning', () => {
  const dir = makeRepo({ '00-docs/specs/SPEC-001.md': '# spec\n', '00-docs/PROJECT_CONTEXT.md': '# ctx\n' })
  const plan = abmh(dir, ['init'])
  assert.doesNotMatch(plan.out, /not from abm-harness/)
})

test('an explicit --docs-dir on a legacy install is honoured even when its old folder has no parent', () => {
  const dir = makeRepo()
  install(dir, ['--docs-dir', 'adr'])
  asLegacy(dir, 'adr')
  const plan = abmh(dir, ['update', '--docs-dir', '00-docs'])
  assert.equal(plan.code, 0)
  assert.match(plan.out, /create-file 00-docs\/decisions\/ \(2 files\)/)
})

test('a trailing slash in a legacy docsDir is ignored', () => {
  const dir = makeRepo()
  install(dir, ['--docs-dir', 'notes/why'])
  asLegacy(dir, 'notes/why/')
  assert.match(abmh(dir, ['update']).out, /create-file notes\/decisions\/ \(2 files\)/)
  const bare = makeRepo()
  install(bare, ['--docs-dir', 'adr'])
  asLegacy(bare, 'adr/')
  assert.equal(abmh(bare, ['update']).code, 4)
})

test('legacy update deletes untouched old decision files and keeps edited ones', () => {
  const dir = makeRepo()
  install(dir, ['--docs-dir', 'notes/why'])
  asLegacy(dir, 'notes/why')
  fs.appendFileSync(path.join(dir, 'notes/why/decisions/README.md'), '\nmine\n')
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /forget notes\/why\/decisions\/README.md - .*edited/)
  assert.equal(abmh(dir, ['update', '--accept-plan', planId(plan.out)]).code, 0)
  assert.match(read(dir, 'notes/why/decisions/README.md'), /mine/)
  assert.equal(exists(dir, 'notes/why/decisions/TEMPLATE.md'), false)
})

test('the foreign-files warning appears only when a file to create collides', () => {
  const quiet = makeRepo({ '00-docs/notes.md': '# mine\n' })
  assert.doesNotMatch(abmh(quiet, ['init']).out, /not from abm-harness/)
  const loud = makeRepo({ '00-docs/LEEME.md': '# mine\n' })
  assert.match(abmh(loud, ['init']).out, /not from abm-harness/)
})
