import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { START } from '../src/block.mjs'
import { abmh, exists, install, makeRepo, manifestOf, planId, read, removeAll, snapshot } from './helpers.mjs'

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex')

const FIXTURES = [
  ['AGENTS.md without trailing newline', { 'AGENTS.md': '# Mine' }],
  ['AGENTS.md with trailing newline', { 'AGENTS.md': '# Mine\n' }],
  ['no AGENTS.md', {}],
  ['GEMINI.md already there', { 'GEMINI.md': 'gemini notes\n', 'AGENTS.md': 'x\n' }],
  ['project with its own files', { 'src/index.js': 'export {}\n', '.claude/settings.json': '{}\n' }],
]

for (const [name, files] of FIXTURES) {
  test(`remove leaves tree and git config as at the start: ${name}`, () => {
    const dir = makeRepo(files)
    const before = snapshot(dir)
    install(dir)
    assert.notDeepEqual(snapshot(dir), before)
    const result = removeAll(dir)
    assert.equal(result.code, 0)
    assert.deepEqual(snapshot(dir), before)
  })
}

test('remove keeps a hand-edited file and a hand-edited block, and lists them', () => {
  const dir = makeRepo({ 'AGENTS.md': '# Mine\n' })
  install(dir)
  fs.appendFileSync(path.join(dir, '.abmh/core/AGENT_BASELINE.md'), '\nmy own rule\n')
  fs.writeFileSync(path.join(dir, 'GEMINI.md'), read(dir, 'GEMINI.md').replace('## ABMH harness', '## ABMH harness (edited)'))
  const plan = abmh(dir, ['remove'])
  assert.match(plan.out, /skip .abmh\/core\/AGENT_BASELINE.md - edited by hand, kept/)
  assert.match(plan.out, /skip GEMINI.md - block edited or missing, kept/)
  assert.equal(abmh(dir, ['remove', '--accept-plan', planId(plan.out)]).code, 0)
  assert.ok(read(dir, '.abmh/core/AGENT_BASELINE.md').includes('my own rule'))
  assert.ok(exists(dir, '.abmh'))
  assert.ok(!exists(dir, '.abmh/skills'))
})

test('remove deletes an AGENTS.md that held only the block', () => {
  const dir = makeRepo()
  install(dir)
  assert.ok(exists(dir, 'AGENTS.md'))
  removeAll(dir)
  assert.ok(!exists(dir, 'AGENTS.md'))
})

test('remove keeps a created AGENTS.md when the human added content', () => {
  const dir = makeRepo()
  install(dir)
  fs.appendFileSync(path.join(dir, 'AGENTS.md'), '\nlater notes\n')
  removeAll(dir)
  assert.equal(read(dir, 'AGENTS.md').includes(START), false)
  assert.ok(read(dir, 'AGENTS.md').includes('later notes'))
})

test('remove restores a previous core.hooksPath value it replaced is impossible: it never replaces one', () => {
  const dir = makeRepo()
  execFileSync('git', ['-C', dir, 'config', 'core.hooksPath', 'mine'])
  install(dir)
  removeAll(dir)
  assert.equal(execFileSync('git', ['-C', dir, 'config', '--get', 'core.hooksPath'], { encoding: 'utf8' }).trim(), 'mine')
})

test('remove and update without a manifest exit 4; a corrupt manifest exits 4', () => {
  const dir = makeRepo()
  assert.equal(abmh(dir, ['remove']).code, 4)
  assert.equal(abmh(dir, ['update']).code, 4)
  install(dir)
  fs.writeFileSync(path.join(dir, '.abmh/manifest.json'), '{ not json')
  const before = snapshot(dir)
  assert.equal(abmh(dir, ['remove']).code, 4)
  assert.equal(abmh(dir, ['update']).code, 4)
  assert.deepEqual(snapshot(dir), before)
})

test('a run killed midway is resumed with the original plan id', () => {
  const dir = makeRepo({ 'AGENTS.md': '# Mine\n' })
  const clean = makeRepo({ 'AGENTS.md': '# Mine\n' })
  install(clean)
  const crashed = install(dir, [], {
    beforeAction: (index) => {
      if (index === 20) throw new Error('killed')
    },
  })
  assert.equal(crashed.code, 5)
  const manifest = manifestOf(dir)
  assert.equal(manifest.status, 'pending')
  const info = abmh(dir, ['init'])
  assert.match(info.out, new RegExp(manifest.planId))
  assert.equal(abmh(dir, ['init', '--accept-plan', manifest.planId]).code, 0)
  assert.equal(manifestOf(dir).status, 'complete')
  const strip = ({ tree }) => tree.filter((line) => !line.includes('manifest.json'))
  assert.deepEqual(strip(snapshot(dir)), strip(snapshot(clean)))
})

test('remove works on an interrupted install', () => {
  const dir = makeRepo({ 'AGENTS.md': '# Mine\n' })
  const before = snapshot(dir)
  install(dir, [], {
    beforeAction: (index) => {
      if (index === 55) throw new Error('killed')
    },
  })
  assert.equal(removeAll(dir).code, 0)
  assert.deepEqual(snapshot(dir), before)
})

test('update skips an edited file and restores a missing one', () => {
  const dir = makeRepo()
  install(dir)
  fs.appendFileSync(path.join(dir, '.abmh/core/AGENT_BASELINE.md'), '\nmine\n')
  fs.rmSync(path.join(dir, '.abmh/core/protocols/GRILL.md'))
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /skip .abmh\/core\/AGENT_BASELINE.md - edited by hand/)
  assert.match(plan.out, /create-file .abmh\/core\/ \(1 file\) - missing, restored/)
  assert.equal(abmh(dir, ['update', '--accept-plan', planId(plan.out)]).code, 0)
  assert.ok(read(dir, '.abmh/core/AGENT_BASELINE.md').includes('mine'))
  assert.ok(exists(dir, '.abmh/core/protocols/GRILL.md'))
})

test('update refreshes a file the harness changed and removes one it dropped', () => {
  const dir = makeRepo()
  install(dir)
  const target = '.abmh/core/protocols/GRILL.md'
  fs.writeFileSync(path.join(dir, target), 'older version')
  const manifest = manifestOf(dir)
  manifest.entries.find((entry) => entry.path === target).sha256 = sha('older version')
  manifest.entries.push({ kind: 'file', path: '.abmh/core/old-file.md', sha256: sha('gone'), createdByInstaller: true })
  fs.writeFileSync(path.join(dir, '.abmh/core/old-file.md'), 'gone')
  fs.writeFileSync(path.join(dir, '.abmh/manifest.json'), JSON.stringify(manifest))
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /update-file .abmh\/core\/ \(1 file\)/)
  assert.match(plan.out, /delete-file .abmh\/core\//)
  assert.equal(abmh(dir, ['update', '--accept-plan', planId(plan.out)]).code, 0)
  assert.ok(read(dir, target).length > 20)
  assert.ok(!exists(dir, '.abmh/core/old-file.md'))
  assert.match(abmh(dir, ['update']).out, /up to date/)
})

test('a live lock stops a second run; a stale lock is taken over', () => {
  const dir = makeRepo()
  fs.mkdirSync(path.join(dir, '.abmh'))
  fs.writeFileSync(path.join(dir, '.abmh/.lock'), String(process.pid))
  const live = abmh(dir, ['init'])
  assert.equal(live.code, 4)
  fs.rmSync(path.join(dir, '.abmh'), { recursive: true })
  const other = makeRepo()
  install(other)
  fs.writeFileSync(path.join(other, '.abmh/.lock'), '999999')
  assert.equal(removeAll(other).code, 0)
})
