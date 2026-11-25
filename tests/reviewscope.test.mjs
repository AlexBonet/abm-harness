import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { change, guard, project, review, track, write } from './reviewhelpers.mjs'

const blocks = (p, session) => /"decision":"block"/.test(guard(p, 'stop', { session_id: session }).stdout)

test('a session that only changed docs is not blocked, with or without tracking', () => {
  const p = project()
  guard(p, 'session-start', { session_id: 's1' })
  write(p, 's1', 'notes.md', '# notes\n')
  write(p, 's1', '_system/consejero/DECISIONS.txt', 'x\n')
  assert.equal(blocks(p, 's1'), false)
  assert.equal(blocks(p, 'untracked-session'), false)
})

test('code changed by another session does not block this one, and still blocks the session that changed it', () => {
  const p = project()
  guard(p, 'session-start', { session_id: 's1' })
  guard(p, 'session-start', { session_id: 's2' })
  track(p, 'pre', { session_id: 's1', tool_name: 'Read' })
  write(p, 's2', 'src/app.js', 'run()\n')
  change(p)
  assert.equal(blocks(p, 's1'), false)
  assert.equal(blocks(p, 's2'), true)
})

test('code this session changed blocks until a verdict covers its current content', () => {
  const p = project()
  guard(p, 'session-start', { session_id: 's1' })
  write(p, 's1', 'src/app.js', 'run()\n')
  const answer = JSON.parse(guard(p, 'stop', { session_id: 's1' }).stdout)
  assert.equal(answer.decision, 'block')
  assert.match(answer.reason, /review\.sh --coder claude/)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small']).status, 0)
  assert.equal(blocks(p, 's1'), false)
  write(p, 's1', 'src/app.js', 'run(2)\n')
  assert.equal(blocks(p, 's1'), true)
})

test('a file changed by a Bash command is tracked; changes made outside the command are not', () => {
  const p = project()
  guard(p, 'session-start', { session_id: 's1' })
  change(p, 'before the command\n')
  track(p, 'pre', { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'sed -i' } })
  fs.writeFileSync(path.join(p.dir, 'b.js'), 'b()\n')
  track(p, 'post', { session_id: 's1', tool_name: 'Bash' })
  const tracked = fs.readFileSync(path.join(p.dir, '.git/abmh-reviews/track-s1'), 'utf8')
  assert.equal(tracked, 'b.js\n')
  assert.equal(blocks(p, 's1'), true)
})

test('review_docs in harness.yaml replaces the default patterns', () => {
  const p = project({ yaml: 'review_docs: "*.txt"\n' })
  guard(p, 'session-start', { session_id: 's1' })
  write(p, 's1', 'a.txt', 'two\n')
  assert.equal(blocks(p, 's1'), false)
  write(p, 's1', 'guide.md', '# guide\n')
  assert.equal(blocks(p, 's1'), true)
})

test('a file name with JSON-escaped quotes and backslashes is tracked as the real path', () => {
  const p = project()
  guard(p, 'session-start', { session_id: 's1' })
  write(p, 's1', 'src/a"b\\c.js', 'x()\n')
  assert.equal(fs.readFileSync(path.join(p.dir, '.git/abmh-reviews/track-s1'), 'utf8'), 'src/a"b\\c.js\n')
  assert.equal(blocks(p, 's1'), true)
})

test('two Bash calls running at once in one session keep their own snapshot', () => {
  const p = project()
  guard(p, 'session-start', { session_id: 's1' })
  track(p, 'pre', { session_id: 's1', tool_name: 'Bash', tool_use_id: 'one' })
  track(p, 'pre', { session_id: 's1', tool_name: 'Bash', tool_use_id: 'two' })
  track(p, 'post', { session_id: 's1', tool_name: 'Bash', tool_use_id: 'one' })
  fs.writeFileSync(path.join(p.dir, 'late.js'), 'late()\n')
  track(p, 'post', { session_id: 's1', tool_name: 'Bash', tool_use_id: 'two' })
  assert.equal(fs.readFileSync(path.join(p.dir, '.git/abmh-reviews/track-s1'), 'utf8'), 'late.js\n')
})

test('a file edited while the reviewer runs is not covered by that verdict', () => {
  const p = project()
  guard(p, 'session-start', { session_id: 's1' })
  write(p, 's1', 'src/app.js', 'run()\n')
  const stub = path.join(p.bin, 'codex')
  const text = fs.readFileSync(stub, 'utf8')
  fs.writeFileSync(stub, text.replace('#!/bin/sh\n', `#!/bin/sh\nprintf 'edited during review\\n' > '${path.join(p.dir, 'src/app.js')}'\n`), { mode: 0o755 })
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small']).status, 0)
  assert.equal(blocks(p, 's1'), true)
})

test('a file name sent with \\u escapes is tracked as the real path', () => {
  const p = project()
  guard(p, 'session-start', { session_id: 's1' })
  fs.mkdirSync(path.join(p.dir, 'src'))
  fs.writeFileSync(path.join(p.dir, 'src/aé.js'), 'x()\n')
  const file = path.join(p.dir, 'src/\\u0061\\u00e9.js')
  track(p, 'post', `{"session_id":"s1","tool_name":"Write","tool_input":{"file_path":"${file}"}}`)
  assert.equal(fs.readFileSync(path.join(p.dir, '.git/abmh-reviews/track-s1'), 'utf8'), 'src/aé.js\n')
  assert.equal(blocks(p, 's1'), true)
})
