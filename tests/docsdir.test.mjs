import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, exists, install, makeRepo, manifestOf, planId, read, removeAll, snapshot } from './helpers.mjs'

test('default docs root is 00-docs, decisions live in 00-docs/decisions and the root is stored in harness.yaml', () => {
  const dir = makeRepo()
  install(dir)
  assert.ok(exists(dir, '00-docs/decisions/README.md'))
  assert.match(read(dir, '.abmh/harness.yaml'), /docsDir: 00-docs\n/)
})

test('--docs-dir moves the docs root, the block and harness.yaml together', () => {
  const dir = makeRepo()
  assert.equal(install(dir, ['--docs-dir', 'notes/why/']).code, 0)
  assert.ok(exists(dir, 'notes/why/decisions/README.md'))
  assert.ok(exists(dir, 'notes/why/decisions/TEMPLATE.md'))
  assert.equal(exists(dir, '00-docs'), false)
  assert.match(read(dir, '.abmh/harness.yaml'), /docsDir: notes\/why\n/)
  assert.match(read(dir, 'AGENTS.md'), /Record decisions in `notes\/why\/decisions\/`/)
  assert.equal(manifestOf(dir).options.docsDir, 'notes/why')
})

test('unsafe --docs-dir values are refused before anything is read', () => {
  const dir = makeRepo()
  for (const value of ['/etc', '../out', 'a/../b', '.abmh/x', '', 'a\\b', '.git/hooks']) {
    const result = abmh(dir, ['init', '--docs-dir', value])
    assert.equal(result.code, 2, value)
  }
  assert.equal(exists(dir, '.abmh'), false)
})

test('a docs folder with foreign files is reported with another path proposed', () => {
  const dir = makeRepo({ '00-docs/decisions/ADR-001-mine.md': '# mine\n', '00-docs/decisions/README.md': '# my own readme\n' })
  const before = snapshot(dir)
  const plan = abmh(dir, ['init'])
  assert.match(plan.out, /\n {2}skip 00-docs - the folder already has files that are not from abm-harness; to keep them apart use --docs-dir 00-docs-abmh/)
  assert.match(plan.out, /skip 00-docs\/decisions\/README.md - exists, not installed by abm-harness/)
  assert.deepEqual(snapshot(dir), before)
  assert.equal(abmh(dir, ['init', '--accept-plan', planId(plan.out)]).code, 0)
  assert.equal(read(dir, '00-docs/decisions/README.md'), '# my own readme\n')
  assert.ok(exists(dir, '00-docs/decisions/TEMPLATE.md'))
  removeAll(dir)
  assert.equal(read(dir, '00-docs/decisions/README.md'), '# my own readme\n')
  assert.ok(exists(dir, '00-docs/decisions/ADR-001-mine.md'))
})

test('update with --docs-dir builds the new folder, keeps edited files and refreshes the block', () => {
  const dir = makeRepo()
  install(dir)
  fs.appendFileSync(path.join(dir, '00-docs/decisions/README.md'), '\nmine\n')
  const plan = abmh(dir, ['update', '--docs-dir', 'adr'])
  assert.match(plan.out, /create-file adr\/decisions\/ \(2 files\)/)
  assert.match(plan.out, /update-block AGENTS.md/)
  assert.match(plan.out, /--docs-dir adr/)
  assert.equal(abmh(dir, ['update', '--docs-dir', 'adr', '--accept-plan', planId(plan.out)]).code, 0)
  assert.ok(exists(dir, 'adr/decisions/README.md'))
  assert.match(read(dir, '.abmh/harness.yaml'), /docsDir: adr\n/)
  assert.match(read(dir, 'AGENTS.md'), /`adr\/decisions\/`/)
  assert.match(read(dir, '00-docs/decisions/README.md'), /mine/)
  assert.equal(exists(dir, '00-docs/decisions/TEMPLATE.md'), false)
})
