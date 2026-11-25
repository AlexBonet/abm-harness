import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { tempDir } from './helpers.mjs'
import { HARNESS, calls, change, guard, project, review } from './reviewhelpers.mjs'

test('opposite is the default: Claude codes, Codex reviews with the cheap model on a small task', () => {
  const p = project()
  change(p)
  const result = review(p, ['--coder', 'claude', '--size', 'small', '--task', 'fix a'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(calls(p), /^codex exec -m gpt-6-luna -s read-only/m)
  assert.match(result.stdout, /Verdict: APPROVED/)
  assert.match(result.stdout, /Reviewer: codex gpt-6-luna/)
})

test('opposite: Codex codes, Claude reviews with Sonnet on a large task', () => {
  const p = project()
  change(p)
  const result = review(p, ['--coder', 'codex', '--size', 'large'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(calls(p), /^claude -p --model sonnet/m)
})

test('reviewer: claude in harness.yaml wins over opposite, and models can be overridden', () => {
  const p = project({ yaml: 'reviewer: claude\nreviewer_claude_small: haiku-next\n' })
  change(p)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small']).status, 0)
  assert.match(calls(p), /^claude -p --model haiku-next/m)
})

test('a change over 150 lines is reviewed as large even if the coder said small', () => {
  const p = project()
  change(p, Array.from({ length: 160 }, (_, i) => `line ${i}`).join('\n'))
  const result = review(p, ['--coder', 'claude', '--size', 'small'])
  assert.match(calls(p), /-m gpt-6\.1-sol/)
  assert.match(result.stdout, /raised to large/)
})

test('when the chosen family is not installed the other one reviews and says so', () => {
  const p = project({ stubs: ['claude'] })
  change(p)
  const result = review(p, ['--coder', 'claude', '--size', 'small'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(calls(p), /^claude -p --model haiku/m)
  assert.match(result.stdout, /codex is not available/)
})

test('the script counts rounds itself: first REJECTED asks for a fix, second says stop, a third needs the owner OK', () => {
  const p = project()
  change(p)
  const first = review(p, ['--coder', 'claude', '--size', 'small'], 'REJECTED\n1. a.txt:1 wrong')
  assert.equal(first.status, 1)
  assert.match(first.stdout, /Round: 1/)
  assert.match(first.stdout, /Round 2 checks these findings/)
  change(p, 'three\n')
  const second = review(p, ['--coder', 'claude', '--size', 'small'], 'REJECTED\n1. still wrong')
  assert.equal(second.status, 1)
  assert.match(second.stdout, /Round: 2/)
  assert.match(second.stdout, /Stop/)
  change(p, 'four\n')
  const before = calls(p)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small']).status, 3)
  assert.equal(calls(p), before)
  const third = review(p, ['--coder', 'claude', '--size', 'small', '--owner-ok'])
  assert.equal(third.status, 0)
  assert.match(third.stdout, /Round: 1/)
})

test('APPROVED resets the count of rounds', () => {
  const p = project()
  change(p)
  review(p, ['--coder', 'claude', '--size', 'small'], 'REJECTED\n1. wrong')
  change(p, 'fixed\n')
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small']).status, 0)
  change(p, 'next task\n')
  assert.match(review(p, ['--coder', 'claude', '--size', 'small'], 'REJECTED\n1. x').stdout, /Round: 1/)
})

test('a family that runs but gives no verdict hands the review to the other one', () => {
  const p = project()
  fs.writeFileSync(path.join(p.bin, 'codex'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
  change(p)
  const result = review(p, ['--coder', 'claude', '--size', 'small'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Reviewer: claude haiku/)
  assert.match(result.stdout, /codex gpt-6-luna gave no valid verdict/)
})

test('an answer without a verdict line is not recorded as a verdict', () => {
  const p = project()
  change(p)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small'], 'I could not decide').status, 2)
  assert.match(guard(p, 'stop', { session_id: 's1' }).stdout, /"decision":"block"/)
})

test('bad arguments are refused', () => {
  const p = project()
  assert.equal(review(p, ['--coder', 'gemini', '--size', 'small']).status, 2)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'medium']).status, 2)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small', '--claims']).status, 2)
})

test('the coder claims reach the reviewer, which must back each one with evidence', () => {
  const p = project()
  change(p)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small', '--task', 'fix a', '--claims', "tests pass; a.txt says 'two'"]).status, 0)
  const prompt = calls(p)
  assert.match(prompt, /Coder's claims \(what it will tell the owner it did; you have not seen its reasoning\): tests pass; a\.txt says 'two'/)
  assert.match(prompt, /A claim with no evidence, or one the evidence contradicts, is a finding/)
})

test('without claims the reviewer is told so, and round 1 blocks only on blocking issues', () => {
  const p = project()
  change(p)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small']).status, 0)
  const prompt = calls(p)
  assert.match(prompt, /Coder's claims: \(not given\)\. Judge the diff only\./)
  assert.match(prompt, /Round 1: a full review\. REJECT only for a blocking issue/)
  assert.match(prompt, /List minor issues \(naming, style, small cleanups\) under a 'Notes:' line/)
})

test('the guard blocks a stop when the session changed files and the diff has no verdict', () => {
  const p = project()
  guard(p, 'session-start', { session_id: 's1', source: 'startup' })
  change(p)
  const result = guard(p, 'stop', { session_id: 's1' })
  assert.equal(result.status, 0)
  const answer = JSON.parse(result.stdout)
  assert.equal(answer.decision, 'block')
  assert.match(answer.reason, /review\.sh --coder claude/)
})

test('the guard lets the stop through once a verdict exists for the current diff, and blocks again if the diff changes', () => {
  const p = project()
  guard(p, 'session-start', { session_id: 's1' })
  change(p)
  review(p, ['--coder', 'claude', '--size', 'small'])
  assert.equal(guard(p, 'stop', { session_id: 's1' }).stdout, '')
  change(p, 'changed after the verdict\n')
  assert.match(guard(p, 'stop', { session_id: 's1' }).stdout, /block/)
})

test('the guard stays quiet with no changes, with changes from before the session, on the second stop and inside a review', () => {
  const p = project()
  assert.equal(guard(p, 'stop', { session_id: 's1' }).stdout, '')
  change(p)
  guard(p, 'session-start', { session_id: 's2' })
  assert.equal(guard(p, 'stop', { session_id: 's2' }).stdout, '')
  guard(p, 'session-start', { session_id: 's3' })
  change(p, 'other\n')
  guard(p, 'session-start', { session_id: 's3', source: 'compact' })
  assert.match(guard(p, 'stop', { session_id: 's3' }).stdout, /block/)
  assert.equal(guard(p, 'stop', { session_id: 's3', stop_hook_active: true }).stdout, '')
  assert.equal(guard(p, 'stop', { session_id: 's3' }, { ABMH_REVIEWING: '1' }).stdout, '')
})

test('the guard does nothing outside a git repository', () => {
  const dir = tempDir()
  fs.mkdirSync(path.join(dir, '.abmh/reviewer'), { recursive: true })
  for (const name of fs.readdirSync(path.join(HARNESS, 'reviewer'))) fs.copyFileSync(path.join(HARNESS, 'reviewer', name), path.join(dir, '.abmh/reviewer', name))
  const result = spawnSync('sh', [path.join(dir, '.abmh/reviewer/guard.sh'), 'stop'], { cwd: dir, input: '{}', encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } })
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
})

test('an untracked nested repository does not break the fingerprint', () => {
  const p = project()
  const nested = path.join(p.dir, 'nested')
  fs.mkdirSync(nested)
  execFileSync('git', ['-C', nested, 'init', '-q'])
  fs.writeFileSync(path.join(nested, 'b.txt'), 'b\n')
  guard(p, 'session-start', { session_id: 's1' })
  change(p)
  const result = review(p, ['--coder', 'claude', '--size', 'small'])
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stderr, /fatal/)
  assert.equal(guard(p, 'stop', { session_id: 's1' }).stdout, '')
})

test('only an exact verdict with every field counts; anything else is no verdict and nothing is recorded', () => {
  const p = project({ stubs: ['codex'] })
  change(p)
  for (const answer of ['APPROVED? Review could not be completed.', 'APPROVED', '**APPROVED**', '  APPROVED  ', 'APPROVED\nRound: 1\nTier: medio', '## VERDICT: APPROVED', 'APPROVED#\nTier: medio', 'APPROVED\nTier: medio\nDiff: x\nReviewer: codex\nRound: 1', 'APPROVED\nTier: medio\nDiff: 000000000000\nReviewer: codex gpt-6-luna\nRound: 1']) {
    const result = review(p, ['--coder', 'claude', '--size', 'small'], answer, true)
    assert.equal(result.status, 2, answer)
    assert.match(result.stderr, /no valid verdict/)
  }
  assert.match(guard(p, 'stop', { session_id: 's1' }).stdout, /block/)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small']).status, 0)
})

test('round 2 is narrower: the reviewer gets the round-1 findings and blocks only on open ones or new severe defects', () => {
  const p = project()
  change(p)
  review(p, ['--coder', 'claude', '--size', 'small'], 'REJECTED\n1. a.txt:1 wrong')
  assert.match(calls(p), /Round 1: a full review/)
  change(p, 'fixed\n')
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small']).status, 0)
  const second = calls(p).split('codex exec').at(-1)
  assert.match(second, /Round 2: the round-1 verdict and findings are in \S*round1-findings\.md/)
  assert.match(second, /new severe defect/)
  change(p, 'next task\n')
  review(p, ['--coder', 'claude', '--size', 'small'])
  assert.match(calls(p).split('codex exec').at(-1), /Round 1: a full review/)
})

test('a shared harness folder outside the repo reviews the repo the command runs in', () => {
  const p = project()
  const shared = tempDir()
  fs.mkdirSync(path.join(shared, '_system/reviewer'), { recursive: true })
  for (const name of fs.readdirSync(path.join(HARNESS, 'reviewer'))) fs.copyFileSync(path.join(HARNESS, 'reviewer', name), path.join(shared, '_system/reviewer', name))
  change(p)
  const env = { PATH: `${p.bin}:/usr/bin:/bin`, STUB_LOG: p.log, STUB_VERDICT: 'APPROVED', HOME: p.bin }
  const result = spawnSync('sh', [path.join(shared, '_system/reviewer/review.sh'), '--coder', 'claude', '--size', 'small'], { cwd: p.dir, env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(calls(p), new RegExp(`-C ${p.dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `))
  assert.match(calls(p), new RegExp(`Read ${shared.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/_system/agents/reviewer\\.md`))
  const blocked = spawnSync('sh', [path.join(shared, '_system/reviewer/guard.sh'), 'stop'], { cwd: p.dir, env: { PATH: '/usr/bin:/bin' }, input: '{"session_id":"x"}', encoding: 'utf8' })
  assert.doesNotMatch(blocked.stdout, /block/)
})

test('the guard answer stays valid JSON when the harness path has quotes or backslashes', () => {
  const p = project()
  const odd = path.join(tempDir(), 'a "b" \\c')
  fs.mkdirSync(path.join(odd, '_system/reviewer'), { recursive: true })
  for (const name of fs.readdirSync(path.join(HARNESS, 'reviewer'))) fs.copyFileSync(path.join(HARNESS, 'reviewer', name), path.join(odd, '_system/reviewer', name))
  change(p)
  const result = spawnSync('sh', [path.join(odd, '_system/reviewer/guard.sh'), 'stop'], { cwd: p.dir, env: { PATH: '/usr/bin:/bin' }, input: '{"session_id":"x"}', encoding: 'utf8' })
  const answer = JSON.parse(result.stdout)
  assert.equal(answer.decision, 'block')
  assert.ok(answer.reason.includes(`${odd}/_system/reviewer/review.sh`))
})

test('--base reviews committed work since that commit, and a bad --base is refused', () => {
  const p = project()
  const first = execFileSync('git', ['-C', p.dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  change(p)
  execFileSync('git', ['-C', p.dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'T1'])
  assert.match(review(p, ['--coder', 'claude', '--size', 'small']).stdout, /Nothing to review/)
  const result = review(p, ['--coder', 'claude', '--size', 'small', '--base', first])
  assert.equal(result.status, 0, result.stderr)
  assert.match(calls(p), new RegExp(`git diff ${first} -- \\.`))
  assert.match(result.stdout, /Verdict: APPROVED/)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small', '--base', 'nope']).status, 2)
})

test('the reviewer is asked whether the job already exists and what can go', () => {
  const p = project()
  change(p)
  assert.equal(review(p, ['--coder', 'claude', '--size', 'small']).status, 0)
  assert.match(calls(p), /already in the project do this job/)
  assert.match(calls(p), /not asked for and can go/)
})
