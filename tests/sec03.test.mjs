import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { project, sh, write } from './checkhelpers.mjs'
import { tempDir } from './helpers.mjs'

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

const git = (dir, ...args) => execFileSync('git', ['-c', 'user.email=t@t.test', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

const commit = (dir, message) => {
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', message)
}

const repo = (files = { 'README.md': 'hello\n' }) => {
  const dir = project({ files })
  write(dir, '.abmh/harness.yaml', 'version: x\nprofile: universal\ndocsDir: 00-docs\n')
  write(dir, '.gitignore', '.abmh/\n')
  commit(dir, 'first')
  return dir
}

const leakAndRemove = (dir, key, file = 'src/a.ts') => {
  write(dir, file, `const k = '${key}'\n`)
  commit(dir, 'add')
  fs.rmSync(path.join(dir, file))
  commit(dir, 'remove')
}

test('SEC-03 passes a clean history', () => {
  assert.equal(sh(repo(), 'sec-03.sh').code, 0)
})

for (const [name, key] of Object.entries(KEYS)) {
  test(`SEC-03 finds ${name} in an old commit that SEC-01 no longer sees, never printing the value`, () => {
    const dir = repo()
    leakAndRemove(dir, key)
    assert.equal(sh(dir, 'sec-01.sh').code, 0)
    const result = sh(dir, 'sec-03.sh')
    assert.equal(result.code, 1)
    assert.match(result.out, new RegExp(`^[0-9a-f]{7,}:src/a\\.ts ${name}$`, 'm'))
    assert.ok(!result.out.includes(key.slice(8)), 'the value leaked')
  })
}

test('SEC-03 reads every branch, not only the current one', () => {
  const dir = repo()
  git(dir, 'branch', '-m', 'main')
  git(dir, 'switch', '-q', '-c', 'side')
  write(dir, 'side.txt', `${KEYS['github-token']}\n`)
  commit(dir, 'side')
  git(dir, 'switch', '-q', 'main')
  assert.equal(sh(dir, 'sec-01.sh').code, 0)
  assert.equal(sh(dir, 'sec-03.sh').code, 1)
})

test('SEC-03 ignores harness files and plain words in history', () => {
  const dir = repo({ 'README.md': 'token = ${TOKEN}\n' })
  write(dir, '.abmh/extra.txt', `${KEYS['aws-access-key']}\n`)
  git(dir, 'add', '-f', '.abmh/extra.txt')
  commit(dir, 'harness file')
  assert.equal(sh(dir, 'sec-03.sh').code, 0)
})

test('SEC-03 honours the allowlist by path and ignores an entry without a reason', () => {
  const dir = repo()
  leakAndRemove(dir, KEYS['aws-access-key'], 'fixtures/k.txt')
  write(dir, '00-docs/secrets-allowlist.txt', 'fixtures/ |\n')
  assert.equal(sh(dir, 'sec-03.sh').code, 1)
  write(dir, '00-docs/secrets-allowlist.txt', 'fixtures/ | sample keys of the test suite\n')
  assert.equal(sh(dir, 'sec-03.sh').code, 0)
})

test('SEC-03 is NOT RUN on a shallow clone, with no commits and outside git', () => {
  const origin = repo()
  leakAndRemove(origin, KEYS['aws-access-key'])
  const shallow = tempDir()
  fs.rmSync(shallow, { recursive: true })
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${origin}`, shallow])
  fs.cpSync(path.join(origin, '.abmh'), path.join(shallow, '.abmh'), { recursive: true })
  const result = sh(shallow, 'sec-03.sh')
  assert.equal(result.code, 2)
  assert.match(result.out, /shallow/)
  const empty = project({ files: {} })
  assert.equal(sh(empty, 'sec-03.sh').code, 2)
  const bare = project({ files: {}, git: false })
  assert.equal(sh(bare, 'sec-03.sh').code, 2)
})

test('check.sh seguridad reports SEC-03 next to SEC-01 and SEC-02', () => {
  const dir = repo()
  write(dir, '00-docs/ROTATION.md', 'x\n')
  leakAndRemove(dir, KEYS['aws-access-key'])
  const result = sh(dir, 'check.sh', ['seguridad'])
  assert.equal(result.code, 1)
  assert.match(result.out, /PASS SEC-01/)
  assert.match(result.out, /FAIL SEC-03/)
})

test('SEC-01 and SEC-03 read the same pattern file', () => {
  const patterns = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '../harness/checks/sec-patterns.txt'), 'utf8')
  for (const name of Object.keys(KEYS)) assert.ok(patterns.includes(`${name}:`), name)
  for (const script of ['sec-01.sh', 'sec-03.sh']) {
    const text = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '../harness/checks', script), 'utf8')
    assert.match(text, /sec-patterns\.txt/)
  }
})
