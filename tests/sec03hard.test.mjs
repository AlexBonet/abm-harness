import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { project, sh, write } from './checkhelpers.mjs'

const KEY = ['AKI', 'A', 'ABCDEFGH12345678'].join('')

const git = (dir, ...args) => execFileSync('git', ['-c', 'user.email=t@t.test', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', '-c', 'core.editor=true', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

const commit = (dir, message = 'x') => {
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', message)
}

const repo = (files = { 'README.md': 'hello\n' }) => {
  const dir = project({ files })
  write(dir, '.abmh/harness.yaml', 'version: x\nprofile: universal\ndocsDir: 00-docs\n')
  write(dir, '.gitignore', '.abmh/\n')
  git(dir, 'branch', '-M', 'main')
  commit(dir, 'first')
  return dir
}

test('SEC-03 is not fooled by an added line that looks like a diff header', () => {
  const dir = repo()
  write(dir, 'a.txt', `++ /dev/null\n${KEY}\n`)
  commit(dir)
  fs.rmSync(path.join(dir, 'a.txt'))
  commit(dir)
  const result = sh(dir, 'sec-03.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /^[0-9a-f]{7,}:a\.txt aws-access-key$/m)
})

test('SEC-03 never takes a header-looking line for a file name', () => {
  const dir = repo()
  write(dir, 'a.txt', `++ b/${KEY}\n${KEY}\n`)
  commit(dir)
  fs.rmSync(path.join(dir, 'a.txt'))
  commit(dir)
  const result = sh(dir, 'sec-03.sh')
  assert.equal(result.code, 1)
  assert.ok(!result.out.includes(KEY.slice(8)))
})

test('SEC-03 reads files that git attributes mark as not diffable', () => {
  const dir = repo({ 'README.md': 'x\n', '.gitattributes': 'config.txt -diff\n' })
  write(dir, 'config.txt', `k=${KEY}\n`)
  commit(dir)
  fs.rmSync(path.join(dir, 'config.txt'))
  commit(dir)
  assert.equal(sh(dir, 'sec-03.sh').code, 1)
})

test('SEC-03 reads a secret added only while resolving a merge conflict', () => {
  const dir = repo({ 'f.txt': 'base\n' })
  git(dir, 'switch', '-q', '-c', 'side')
  write(dir, 'f.txt', 'side\n')
  commit(dir, 'side')
  git(dir, 'switch', '-q', 'main')
  write(dir, 'f.txt', 'main\n')
  commit(dir, 'main')
  try {
    git(dir, 'merge', 'side')
  } catch {
    write(dir, 'f.txt', `k=${KEY}\n`)
    commit(dir, 'merge')
  }
  write(dir, 'f.txt', 'clean\n')
  commit(dir, 'clean')
  assert.equal(sh(dir, 'sec-01.sh').code, 0)
  assert.equal(sh(dir, 'sec-03.sh').code, 1)
})

test('SEC-03 names a file with spaces in its path', () => {
  const dir = repo()
  write(dir, 'my notes/k.txt', `${KEY}\n`)
  commit(dir)
  fs.rmSync(path.join(dir, 'my notes'), { recursive: true })
  commit(dir)
  assert.match(sh(dir, 'sec-03.sh').out, /^[0-9a-f]{7,}:my notes\/k\.txt aws-access-key$/m)
})

for (const script of ['sec-01.sh', 'sec-03.sh']) {
  test(`${script} is NOT RUN, never PASS, when the pattern file is missing or empty`, () => {
    const dir = repo()
    fs.rmSync(path.join(dir, '.abmh/checks/sec-patterns.txt'))
    assert.equal(sh(dir, script).code, 2)
    write(dir, '.abmh/checks/sec-patterns.txt', '')
    assert.equal(sh(dir, script).code, 2)
  })
}
