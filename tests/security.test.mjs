import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { project, sh, write } from './checkhelpers.mjs'
import { install, makeRepo, read } from './helpers.mjs'

const body = (length, alphabet = 'AbCdEfGh1234567890') => alphabet.repeat(Math.ceil(length / alphabet.length)).slice(0, length)

const KEYS = {
  'aws-access-key': ['AKI', 'A', body(16, 'ABCDEFGH12345678')].join(''),
  'private-key': ['-----BEGIN RSA ', 'PRIVATE KEY-----'].join(''),
  'github-token': ['gh', 'p_', body(36)].join(''),
  'github-token-fine': ['github', '_pat_', body(60)].join(''),
  'slack-token': ['xo', 'xb-', body(24)].join(''),
  'stripe-live-key': ['sk', '_live_', body(24)].join(''),
  'anthropic-key': ['sk', '-ant-', body(40)].join(''),
  'openai-key': ['sk', '-proj-', body(48)].join(''),
  'google-api-key': ['AI', 'za', body(35)].join(''),
  'generic-secret': `api_key = "${body(32)}"`,
}

const gitDir = (files, ignored = '') => {
  const dir = project({ files })
  write(dir, '.abmh/harness.yaml', 'version: x\nprofile: universal\ndocsDir: 00-docs\n')
  if (ignored) write(dir, '.gitignore', ignored)
  return dir
}

test('SEC-01 passes a clean project and ignores harness files and plain words', () => {
  const dir = gitDir({ 'src/a.ts': 'const risk = "risk-assessment-for-the-quarterly-review-of-all-teams"\n', 'README.md': 'token = ${TOKEN}\npassword = process.env.PASSWORD\n' })
  write(dir, '.abmh/checks/extra.sh', `${KEYS['aws-access-key']}\n`)
  assert.equal(sh(dir, 'sec-01.sh').code, 0)
})

for (const [name, key] of Object.entries(KEYS)) {
  test(`SEC-01 fails on ${name} naming file, line and pattern, never the value`, () => {
    const dir = gitDir({ 'src/a.ts': `const x = 1\n${name === 'generic-secret' ? key : `const k = '${key}'`}\n` })
    const result = sh(dir, 'sec-01.sh')
    assert.equal(result.code, 1)
    assert.match(result.out, new RegExp(`src/a\\.ts:2 ${name}`))
    assert.ok(!result.out.includes(key.slice(8)), 'the value leaked')
  })
}

test('SEC-01 reads assistant configs, files with spaces and files not yet committed', () => {
  const dir = gitDir({ '.codex/config.toml': `${KEYS['generic-secret']}\n`, 'my notes/k.txt': `${KEYS['github-token']}\n` })
  const result = sh(dir, 'sec-01.sh')
  assert.match(result.out, /\.codex\/config\.toml:1 generic-secret/)
  assert.match(result.out, /my notes\/k\.txt:1 github-token/)
})

test('SEC-01 skips files git ignores and binary files', () => {
  const dir = gitDir({ 'local/key.txt': `${KEYS['aws-access-key']}\n` }, 'local/\n')
  write(dir, 'blob.bin', `\u0000${KEYS['aws-access-key']}\u0000\n`)
  assert.equal(sh(dir, 'sec-01.sh').code, 0)
})

test('SEC-01 fails on a committed .env file but not on examples', () => {
  const dir = gitDir({ '.env': 'A=1\n', 'web/.env.local': 'A=1\n', '.env.example': 'A=\n', '.env.sample': 'A=\n' })
  const result = sh(dir, 'sec-01.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /^\.env: committed env file$/m)
  assert.match(result.out, /^web\/\.env\.local: committed env file$/m)
  assert.doesNotMatch(result.out, /example|sample/)
})

test('SEC-01 honours the allowlist, one path or folder per line with a reason', () => {
  const files = { 'fixtures/a.txt': `${KEYS['aws-access-key']}\n`, 'src/b.txt': `${KEYS['github-token']}\n`, 'src/c.txt': `${KEYS['slack-token']}\n` }
  const dir = gitDir(files)
  write(dir, '00-docs/secrets-allowlist.txt', 'fixtures/ | fake keys for tests\nsrc/b.txt | public sample\n')
  const result = sh(dir, 'sec-01.sh')
  assert.equal(result.code, 1)
  assert.equal(result.out.trim(), 'src/c.txt:1 slack-token')
  const partial = gitDir(files)
  write(partial, '00-docs/secrets-allowlist.txt', 'fixtures/ | fake keys for tests\n')
  assert.match(sh(partial, 'sec-01.sh').out, /src\/b\.txt:1 github-token/)
})

test('SEC-01 fails on an allowlist entry without a reason and exempts nothing', () => {
  const dir = gitDir({ 'fixtures/a.txt': `${KEYS['aws-access-key']}\n` })
  write(dir, '00-docs/secrets-allowlist.txt', 'fixtures/a.txt\nfixtures/a.txt |\n')
  const result = sh(dir, 'sec-01.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /secrets-allowlist\.txt:1 entry without a reason/)
  assert.match(result.out, /fixtures\/a\.txt:1 aws-access-key/)
})

test('SEC-01 is NOT RUN outside a git repository', () => {
  const dir = project({ git: false, files: { 'a.txt': 'x' } })
  assert.equal(sh(dir, 'sec-01.sh').code, 2)
})

test('SEC-01 reads nothing outside the project', () => {
  const dir = gitDir({ 'a.txt': 'x\n' })
  const result = spawnSync('sh', ['-c', 'cd "$1" && sh .abmh/checks/sec-01.sh', 'x', dir], { encoding: 'utf8', env: { ...process.env, HOME: '/nonexistent' } })
  assert.equal(result.status, 0)
})

const executable = (dir, rel, text) => {
  write(dir, rel, text)
  fs.chmodSync(path.join(dir, rel), 0o755)
}

test('SEC-02 needs ROTATION.md in the docs folder', () => {
  assert.equal(sh(gitDir({ 'README.md': 'x' }), 'sec-02.sh').code, 2)
  const dir = gitDir({ '00-docs/LEEME.md': 'x' })
  assert.equal(sh(dir, 'sec-02.sh').code, 1)
  assert.match(sh(dir, 'sec-02.sh').out, /00-docs\/ROTATION\.md is missing/)
  write(dir, '00-docs/ROTATION.md', 'Audience: both\n')
  assert.equal(sh(dir, 'sec-02.sh').code, 0)
})

test('SEC-02 fails when the active pre-push hook does not call the scan', () => {
  const dir = gitDir({ '00-docs/ROTATION.md': 'Audience: both\n' })
  executable(dir, '.git/hooks/pre-push', '#!/bin/sh\nexit 0\n')
  const result = sh(dir, 'sec-02.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /pre-push hook does not run sec-01/)
  executable(dir, '.git/hooks/pre-push', '#!/bin/sh\nsh .abmh/checks/sec-01.sh\n')
  assert.equal(sh(dir, 'sec-02.sh').code, 0)
})

const HUMAN = { AI_AGENT: '', CLAUDECODE: '' }

function push(dir, { agent = false, target = 'refs/heads/feature' } = {}) {
  const env = { ...process.env, ...HUMAN, ...(agent ? { AI_AGENT: 'x' } : {}) }
  return spawnSync('sh', ['.abmh/hooks/pre-push'], { cwd: dir, env, encoding: 'utf8', input: `refs/heads/work 1111 ${target} 2222\n` })
}

test('the installed pre-push hook blocks a leaked secret for people and agents, without printing it', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir)
  assert.equal(push(dir).status, 0)
  write(dir, 'src/k.ts', `const k = '${KEYS['github-token']}'\n`)
  for (const agent of [false, true]) {
    const result = push(dir, { agent })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /src\/k\.ts:1 github-token/)
    assert.match(result.stderr, /SEC-01/)
    assert.ok(!`${result.stdout}${result.stderr}`.includes(KEYS['github-token'].slice(8)))
  }
})

test('the pre-push hook still stops agents on main, still lets people and branches through', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir)
  assert.equal(push(dir, { agent: true, target: 'refs/heads/main' }).status, 1)
  assert.equal(push(dir, { agent: true }).status, 0)
  assert.equal(push(dir, { target: 'refs/heads/main' }).status, 0)
})

test('the pre-push hook lets the push through when the scan is not installed or cannot run', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir)
  write(dir, 'src/k.ts', `const k = '${KEYS['github-token']}'\n`)
  fs.rmSync(path.join(dir, '.abmh/checks/sec-01.sh'))
  assert.equal(push(dir).status, 0)
})

test('init creates ROTATION.md with the docs header in both languages', () => {
  for (const [lang, summary] of [['en', /^> \*\*Summary:\*\*/m], ['es', /^> \*\*Resumen:\*\*/m]]) {
    const dir = makeRepo({ 'README.md': 'x\n' })
    install(dir, ['--lang', lang])
    const text = read(dir, '00-docs/ROTATION.md')
    assert.match(text, /^Audience: both$/m)
    assert.match(text, summary)
    assert.equal(sh(dir, 'sec-02.sh').code, 0)
  }
})

test('SEC-01 reads names with accents, backslashes and quotes', () => {
  const dir = gitDir({ 'café.txt': `${KEYS['aws-access-key']}\n`, 'back\\slash.txt': `${KEYS['aws-access-key']}\n`, 'quo"te.txt': `${KEYS['aws-access-key']}\n` })
  const result = sh(dir, 'sec-01.sh')
  assert.match(result.out, /café\.txt:1 aws-access-key/)
  assert.match(result.out, /back\\slash\.txt:1 aws-access-key/)
  assert.match(result.out, /quo"te\.txt:1 aws-access-key/)
})

test('SEC-01 ignores deleted env files, env examples and symlinks, and knows private and service keys', () => {
  const dir = gitDir({ '.env': 'A=1\n', '.env.local.example': 'A=\n', 'outside/k.txt': `${KEYS['aws-access-key']}\n` })
  spawnSync('git', ['add', '.env', 'outside'], { cwd: dir })
  fs.rmSync(path.join(dir, '.env'))
  fs.symlinkSync(path.join(dir, 'outside/k.txt'), path.join(dir, 'link.txt'))
  fs.rmSync(path.join(dir, 'outside'), { recursive: true })
  assert.equal(sh(dir, 'sec-01.sh').code, 0)
  const names = gitDir({ 'a.env.ts': `PRIVATE_KEY = "${body(32)}"\nSERVICE_ROLE_KEY: '${body(40)}'\n` })
  assert.match(sh(names, 'sec-01.sh').out, /a\.env\.ts:1 generic-secret\na\.env\.ts:2 generic-secret/)
})

test('SEC-04 fails on a tracked .claude file at any depth and passes when ignored', () => {
  const clean = gitDir({ 'README.md': 'x' }, '.claude/\n')
  assert.equal(sh(clean, 'sec-04.sh').code, 0)
  const dirty = gitDir({ 'README.md': 'x', 'pou/.claude/commands/review.md': 'x' })
  execFileSync('git', ['add', '-A'], { cwd: dirty })
  const result = sh(dirty, 'sec-04.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /pou\/\.claude\/commands\/review\.md: file under \.claude\//)
})

test('SEC-04 is NOT RUN outside a git repository', () => {
  assert.equal(sh(project({ git: false, files: { 'a.txt': 'x' } }), 'sec-04.sh').code, 2)
})

test('the installed pre-push hook blocks a tracked .claude file for people and agents', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir)
  write(dir, '.claude/commands/review.md', 'x\n')
  execFileSync('git', ['add', '-f', '.claude/commands/review.md'], { cwd: dir })
  for (const agent of [false, true]) {
    const result = push(dir, { agent })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /SEC-04/)
  }
})

test('SEC-04 also catches a tracked .claude file whose name git would quote', () => {
  const dirty = gitDir({ 'README.md': 'x', '.claude/a\tb.md': 'x' })
  execFileSync('git', ['add', '-A'], { cwd: dirty })
  assert.equal(sh(dirty, 'sec-04.sh').code, 1)
})
