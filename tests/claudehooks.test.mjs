import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, exists, install, makeRepo, read, removeAll, snapshot } from './helpers.mjs'

const SETTINGS = '.claude/settings.json'
const guardCommands = (data, event) => (data.hooks?.[event] ?? []).flatMap((group) => group.hooks.map((hook) => hook.command)).filter((command) => command.includes('.abmh/reviewer/guard.sh'))

test('init with Claude installs the review scripts, the reviewer key and the Stop and SessionStart guard', () => {
  const dir = makeRepo()
  assert.equal(install(dir).code, 0)
  assert.equal(fs.statSync(path.join(dir, '.abmh/reviewer/review.sh')).mode & 0o111, 0o111)
  assert.match(read(dir, '.abmh/harness.yaml'), /^reviewer: opposite$/m)
  const data = JSON.parse(read(dir, SETTINGS))
  assert.deepEqual(guardCommands(data, 'Stop'), ['sh "$CLAUDE_PROJECT_DIR/.abmh/reviewer/guard.sh" stop'])
  assert.deepEqual(guardCommands(data, 'SessionStart'), ['sh "$CLAUDE_PROJECT_DIR/.abmh/reviewer/guard.sh" session-start'])
})

test('remove takes the guard away and leaves the tree as it was', () => {
  const dir = makeRepo({ 'a.txt': 'x\n' })
  const before = snapshot(dir)
  install(dir)
  assert.equal(removeAll(dir).code, 0)
  assert.deepEqual(snapshot(dir), before)
})

test('an existing settings.json keeps its content and its own hooks, and remove restores it byte for byte', () => {
  const original = '{"permissions":{"allow":["Bash(ls)"]},\n "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "echo mine"}]}]}}\n'
  const dir = makeRepo({ [SETTINGS]: original })
  assert.equal(install(dir).code, 0)
  const data = JSON.parse(read(dir, SETTINGS))
  assert.deepEqual(data.permissions, { allow: ['Bash(ls)'] })
  assert.equal(data.hooks.Stop.length, 2)
  assert.equal(data.hooks.Stop[0].hooks[0].command, 'echo mine')
  assert.equal(removeAll(dir).code, 0)
  assert.equal(read(dir, SETTINGS), original)
})

test('a settings.json edited after install keeps the edit on remove and loses only the guard', () => {
  const dir = makeRepo({ [SETTINGS]: '{"model":"opus"}\n' })
  install(dir)
  const data = JSON.parse(read(dir, SETTINGS))
  fs.writeFileSync(path.join(dir, SETTINGS), JSON.stringify({ ...data, theme: 'dark' }))
  assert.equal(removeAll(dir).code, 0)
  assert.deepEqual(JSON.parse(read(dir, SETTINGS)), { model: 'opus', theme: 'dark' })
})

test('a settings.json that is not valid JSON is left untouched and the plan says so', () => {
  const dir = makeRepo({ [SETTINGS]: '{ not json' })
  const plan = abmh(dir, ['init'])
  assert.match(plan.out, /not valid JSON/)
  install(dir)
  assert.equal(read(dir, SETTINGS), '{ not json')
})

test('no guard without Claude or with --no-hooks', () => {
  const codexOnly = makeRepo()
  install(codexOnly, ['--assistants', 'codex'])
  assert.equal(exists(codexOnly, SETTINGS), false)
  assert.equal(exists(codexOnly, '.abmh/reviewer/review.sh'), true)
  const noHooks = makeRepo()
  install(noHooks, ['--no-hooks'])
  assert.equal(exists(noHooks, SETTINGS), false)
})

test('update after init does not touch the guard again', () => {
  const dir = makeRepo()
  install(dir)
  const plan = abmh(dir, ['update'])
  assert.doesNotMatch(plan.out, /claude-hooks/)
})

test('a user hook added to the guard group survives remove', () => {
  const dir = makeRepo()
  install(dir)
  const data = JSON.parse(read(dir, SETTINGS))
  data.hooks.Stop[0].hooks.push({ type: 'command', command: 'echo mine' })
  fs.writeFileSync(path.join(dir, SETTINGS), JSON.stringify(data))
  assert.equal(removeAll(dir).code, 0)
  assert.deepEqual(JSON.parse(read(dir, SETTINGS)), { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] } })
})

test('empty hook structures and the file mode come back exactly on remove', () => {
  for (const original of ['{"hooks":{}}\n', '{"hooks":{"Stop":[]}}\n']) {
    const dir = makeRepo({ [SETTINGS]: original })
    fs.chmodSync(path.join(dir, SETTINGS), 0o600)
    install(dir)
    assert.equal(removeAll(dir).code, 0)
    assert.equal(read(dir, SETTINGS), original)
    assert.equal(fs.statSync(path.join(dir, SETTINGS)).mode & 0o777, 0o600)
  }
})

test('empty hook lists the user had survive remove even when other settings were edited after install', () => {
  for (const original of ['{"hooks":{"PreToolUse":[]}}\n', '{"hooks":{"Stop":[]}}\n', '{"hooks":{}}\n']) {
    const dir = makeRepo({ [SETTINGS]: original })
    install(dir)
    const data = JSON.parse(read(dir, SETTINGS))
    fs.writeFileSync(path.join(dir, SETTINGS), JSON.stringify({ ...data, theme: 'dark' }))
    assert.equal(removeAll(dir).code, 0)
    assert.deepEqual(JSON.parse(read(dir, SETTINGS)), { ...JSON.parse(original), theme: 'dark' })
  }
})

test('groups the user left without hooks are not touched by remove', () => {
  const original = { hooks: { Stop: [{ hooks: [] }], PreToolUse: [{ matcher: 'Bash', hooks: [] }] } }
  const dir = makeRepo({ [SETTINGS]: JSON.stringify(original) })
  install(dir)
  const data = JSON.parse(read(dir, SETTINGS))
  fs.writeFileSync(path.join(dir, SETTINGS), JSON.stringify({ ...data, theme: 'dark' }))
  assert.equal(removeAll(dir).code, 0)
  assert.deepEqual(JSON.parse(read(dir, SETTINGS)), { ...original, theme: 'dark' })
})

test('a guard command the user extended is theirs and survives remove', () => {
  const dir = makeRepo()
  install(dir)
  const data = JSON.parse(read(dir, SETTINGS))
  data.hooks.Stop[0].hooks[0].command += ' && echo custom-cleanup'
  fs.writeFileSync(path.join(dir, SETTINGS), JSON.stringify(data))
  assert.equal(removeAll(dir).code, 0)
  assert.deepEqual(JSON.parse(read(dir, SETTINGS)).hooks.Stop, data.hooks.Stop)
})
