import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildRoot, drift, sourceFiles } from '../scripts/sync.mjs'
import { inProfile } from '../src/profiles.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HARNESS = path.join(ROOT, 'harness')

function everyFile(dir) {
  return fs.readdirSync(dir, { recursive: true }).map((rel) => path.join(dir, rel)).filter((file) => fs.statSync(file).isFile())
}

test('the harness names nobody and carries no mods', () => {
  const offenders = everyFile(HARNESS).filter((file) => /\balex\b|abms-(cabina|guardia|migraciones)/i.test(fs.readFileSync(file, 'utf8')))
  assert.deepEqual(offenders, [])
})

test('the harness points to .abmh/core, never to _system', () => {
  const offenders = everyFile(HARNESS).filter((file) => fs.readFileSync(file, 'utf8').includes('_system/'))
  assert.deepEqual(offenders, [])
})

test('the installed baseline carries the pnpm rule', () => {
  assert.match(fs.readFileSync(path.join(HARNESS, 'core/AGENT_BASELINE.md'), 'utf8'), /use pnpm/i)
})

const HAS_ROOT = fs.existsSync(path.join(ROOT, '../_system'))

test('sync --check passes against the ABMS root', { skip: !HAS_ROOT }, () => {
  const result = spawnSync('node', [path.join(ROOT, 'scripts/sync.mjs'), '--check'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})

test('sync writes the root flavor into a clean tree and reports drift', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-root-'))
  const files = sourceFiles()
  const write = spawnSync('node', [path.join(ROOT, 'scripts/sync.mjs'), '--root', target], { encoding: 'utf8' })
  assert.equal(write.status, 0, write.stderr)
  assert.deepEqual(drift(files, target), [])
  assert.match(fs.readFileSync(path.join(target, '_system/AGENT_BASELINE.md'), 'utf8'), /Alex/)
  assert.doesNotMatch(fs.readFileSync(path.join(target, '_system/AGENT_BASELINE.md'), 'utf8'), /\{\{/)
  fs.appendFileSync(path.join(target, '_system/AGENT_BASELINE.md'), 'drift')
  fs.writeFileSync(path.join(target, '_system/templates/extra.md'), 'x')
  fs.rmSync(path.join(target, '_system/protocols/GRILL.md'))
  assert.deepEqual(drift(files, target).sort(), [
    'differs: _system/AGENT_BASELINE.md',
    'extra: _system/templates/extra.md',
    'missing: _system/protocols/GRILL.md',
  ])
})

test('drift reports a stale VERSION', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-root-'))
  const files = sourceFiles()
  spawnSync('node', [path.join(ROOT, 'scripts/sync.mjs'), '--root', target], { encoding: 'utf8' })
  const changed = files.map((file, index) => (index === 0 ? { ...file, text: `${file.text}x` } : file))
  assert.ok(drift(changed, target).includes('differs: harness/VERSION'))
})

test('sync --root without a value is a usage error', () => {
  const result = spawnSync('node', [path.join(ROOT, 'scripts/sync.mjs'), '--root'], { encoding: 'utf8' })
  assert.equal(result.status, 2)
  assert.doesNotMatch(result.stderr, /TypeError/)
})

test('drift reports stale generated files, lost modes and unmapped sources', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-root-'))
  spawnSync('node', [path.join(ROOT, 'scripts/sync.mjs'), '--root', target], { encoding: 'utf8' })
  fs.writeFileSync(path.join(target, '.claude/agents/abms-review-ghost.md'), 'x')
  fs.writeFileSync(path.join(target, '.claude/agents/mine.md'), 'x')
  fs.mkdirSync(path.join(target, '_system/review/fixtures'), { recursive: true })
  fs.writeFileSync(path.join(target, '_system/review/fixtures/a.md'), 'x')
  fs.chmodSync(path.join(target, 'tools/git-hooks/pre-push'), 0o644)
  const files = [...sourceFiles(), { rel: 'core/newdir/X.md', text: 'x', executable: false }]
  const problems = drift(files, target).filter((line) => !line.includes('VERSION'))
  assert.deepEqual(problems.sort(), [
    'extra: .claude/agents/abms-review-ghost.md',
    'mode: tools/git-hooks/pre-push',
    'unmapped: harness/core/newdir/X.md',
  ])
})

test('every token in harness/ is a known one', () => {
  const unknown = everyFile(HARNESS).flatMap((file) =>
    [...fs.readFileSync(file, 'utf8').matchAll(/\{\{([A-Za-z_]+)\}\}/g)].map((match) => match[1]).filter((name) => !['CORE', 'OWNER', 'SUMMARY', 'ASK_OWNER', 'DOCS', 'ABMH'].includes(name)),
  )
  assert.deepEqual(unknown, [])
})

test('lanes, gates, agent cards and strict.md reach _system and the cards stay out of .claude/agents', () => {
  const file = (rel) => ({ rel, text: `{{ABMH}}${rel}`, executable: false })
  const built = buildRoot(['agents/router.md', 'agents/abms-review-risk.md', 'lanes/bug.md', 'gates/test.md', 'strict.md'].map(file))
  assert.deepEqual(
    built.map((entry) => entry.rel).sort(),
    ['.claude/agents/abms-review-risk.md', '_system/agents/router.md', '_system/gates/test.md', '_system/lanes/bug.md', '_system/strict.md'],
  )
  assert.equal(built.find((entry) => entry.rel === '_system/lanes/bug.md').text, '_system/lanes/bug.md')
})

test('drift flags unmapped lanes only when the mapping is missing and strict.md is strict-only', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-root-'))
  const problems = drift([{ rel: 'lanes/bug.md', text: 'x', executable: false }], target).filter((line) => !line.includes('VERSION'))
  assert.deepEqual(problems, ['missing: _system/lanes/bug.md'])
  const stray = drift([{ rel: 'foo/x.md', text: 'x', executable: false }], target).filter((line) => !line.includes('VERSION'))
  assert.deepEqual(stray, ['unmapped: harness/foo/x.md'])
  assert.equal(inProfile('universal', 'strict.md'), false)
  assert.equal(inProfile('abm-estricto', 'strict.md'), true)
  assert.equal(inProfile('universal', 'lanes/bug.md'), true)
})
