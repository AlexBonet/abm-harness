import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, install, makeRepo, planId, read, snapshot } from './helpers.mjs'

test('init prints a plan and writes nothing', () => {
  const dir = makeRepo({ 'AGENTS.md': '# Mine\n' })
  const before = snapshot(dir)
  const result = abmh(dir, ['init'])
  assert.equal(result.code, 0)
  assert.match(result.out, /plan id: [0-9a-f]{64}/)
  assert.deepEqual(snapshot(dir), before)
  assert.ok(result.out.split('\n').length <= 60)
})

test('the plan id is stable and changes with the project', () => {
  const dir = makeRepo({ 'AGENTS.md': '# Mine\n' })
  const first = planId(abmh(dir, ['init']).out)
  assert.equal(planId(abmh(dir, ['init']).out), first)
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Mine, edited\n')
  assert.notEqual(planId(abmh(dir, ['init']).out), first)
})

test('the plan id changes with the options', () => {
  const dir = makeRepo()
  assert.notEqual(planId(abmh(dir, ['init']).out), planId(abmh(dir, ['init', '--lang', 'en']).out))
})

test('a changed project gives exit 3 and writes nothing', () => {
  const dir = makeRepo({ 'AGENTS.md': '# Mine\n' })
  const id = planId(abmh(dir, ['init']).out)
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Changed after the plan\n')
  const before = snapshot(dir)
  const result = abmh(dir, ['init', '--accept-plan', id])
  assert.equal(result.code, 3)
  assert.match(result.err, /ABMH_PLAN_CHANGED/)
  assert.deepEqual(snapshot(dir), before)
})

test('a wrong accept id gives exit 3', () => {
  const dir = makeRepo()
  assert.equal(abmh(dir, ['init', '--accept-plan', 'deadbeef']).code, 3)
})

test('another selection changes the id, so the old id is refused', () => {
  const dir = makeRepo()
  const id = planId(abmh(dir, ['init']).out)
  assert.equal(abmh(dir, ['init', '--assistants', 'codex', '--accept-plan', id]).code, 3)
})

test('exit 2 for bad usage', () => {
  const dir = makeRepo()
  assert.equal(abmh(dir, ['init', '--lang', 'fr']).code, 2)
  assert.equal(abmh(dir, ['init', '--assistants', 'vim']).code, 2)
  assert.match(abmh(dir, ['init', '--assistants', 'vim']).err, /Valid: claude, codex, gemini, cursor, opencode/)
  assert.equal(abmh(dir, ['frobnicate']).code, 2)
  assert.equal(abmh(dir, ['update', '--lang', 'en']).code, 2)
  assert.equal(abmh(dir, ['init', '--bogus']).code, 2)
})

test('exit 4 when the root is the home folder', () => {
  const result = abmh(os.homedir(), ['init'])
  assert.equal(result.code, 4)
})

test('exit 4 from a subdirectory of a repository', () => {
  const dir = makeRepo()
  fs.mkdirSync(path.join(dir, 'packages/app'), { recursive: true })
  assert.equal(abmh(path.join(dir, 'packages/app'), ['init']).code, 4)
})

test('exit 4 when .abmh exists and is not ours', () => {
  const dir = makeRepo({ '.abmh/notes.txt': 'mine' })
  const result = abmh(dir, ['init'])
  assert.equal(result.code, 4)
  assert.equal(read(dir, '.abmh/notes.txt'), 'mine')
})

test('exit 5 when apply fails, state stays recorded', () => {
  const dir = makeRepo()
  const result = install(dir, [], {
    beforeAction: (index) => {
      if (index === 3) throw new Error('disk full')
    },
  })
  assert.equal(result.code, 5)
  assert.match(result.err, /disk full/)
})

test('--lang en installs english headings, es keeps Resumen', () => {
  const english = makeRepo()
  install(english, ['--lang', 'en'])
  assert.match(read(english, '.abmh/core/templates/SPEC.template.md'), /## Summary/)
  const spanish = makeRepo()
  install(spanish)
  assert.match(read(spanish, '.abmh/core/templates/SPEC.template.md'), /## Resumen/)
})
