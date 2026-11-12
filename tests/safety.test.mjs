import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, install, makeRepo, read, tempDir } from './helpers.mjs'

test('a symlinked .claude pointing outside the project is refused', () => {
  const outside = tempDir()
  const dir = makeRepo()
  fs.symlinkSync(outside, path.join(dir, '.claude'))
  const result = abmh(dir, ['init'])
  assert.equal(result.code, 4)
  assert.match(result.err, /outside the project root/)
  assert.deepEqual(fs.readdirSync(outside), [])
})

test('an AGENTS.md symlinked outside the project is refused', () => {
  const outside = tempDir()
  fs.writeFileSync(path.join(outside, 'notes.md'), 'outside\n')
  const dir = makeRepo()
  fs.symlinkSync(path.join(outside, 'notes.md'), path.join(dir, 'AGENTS.md'))
  assert.equal(abmh(dir, ['init']).code, 4)
  assert.equal(fs.readFileSync(path.join(outside, 'notes.md'), 'utf8'), 'outside\n')
})

test('the filesystem root is refused', () => {
  assert.equal(abmh(tempDir(), ['init', '--root', '/']).code, 4)
})

test('a subdirectory may be named with --root and then skips the hook', () => {
  const repo = makeRepo()
  const inner = path.join(repo, 'packages/app')
  fs.mkdirSync(inner, { recursive: true })
  const plan = abmh(repo, ['init', '--root', inner])
  assert.equal(plan.code, 0)
  assert.match(plan.out, /skip git hook - the root is not the repository top level/)
})

test('a missing root is a usage error', () => {
  assert.equal(abmh(tempDir(), ['init', '--root', '/definitely/not/here']).code, 2)
})

test('a dangling link target path does not escape', () => {
  const outside = tempDir()
  const dir = makeRepo()
  fs.mkdirSync(path.join(dir, '.agents'))
  fs.symlinkSync(path.join(outside, 'later'), path.join(dir, '.agents/skills'))
  const result = abmh(dir, ['init'])
  assert.equal(result.code, 4)
  assert.deepEqual(fs.readdirSync(outside), [])
})

test('nothing is written outside the project during a full install', () => {
  const parent = tempDir()
  const dir = path.join(parent, 'project')
  fs.mkdirSync(dir)
  execFileSync('git', ['init', '-q', dir])
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Mine\n')
  install(dir)
  assert.deepEqual(fs.readdirSync(parent), ['project'])
  assert.ok(read(dir, 'AGENTS.md').startsWith('# Mine'))
})
