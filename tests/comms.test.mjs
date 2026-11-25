import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { project, sh, write } from './checkhelpers.mjs'

const doc = (extra = '') => `# T\n\nAudience: both\n\n> **Summary:** s\n> Last reviewed: 2026-11-01\n${extra}`

test('COM-01 fails naming files without Audience or summary and skips archive', () => {
  const dir = project({ files: { '00-docs/STATUS.md': doc(), '00-docs/NOTES.md': '# Notes\n\ntext\n', '00-docs/archive/old.md': '# old\n' } })
  const bad = sh(dir, 'com-01.sh')
  assert.equal(bad.code, 1)
  assert.deepEqual(bad.out.trim().split('\n'), ['00-docs/NOTES.md: missing the Audience line in the first 8 lines', '00-docs/NOTES.md: missing the summary quote in the first 8 lines'])
  write(dir, '00-docs/NOTES.md', '# Notes\n\nAudience: agent\n\n> **Resumen:** x\n')
  assert.equal(sh(dir, 'com-01.sh').code, 0)
  assert.equal(sh(project(), 'com-01.sh').code, 2)
})

test('COM-01 uses the docs folder from harness.yaml', () => {
  const dir = project({ files: { 'notes/A.md': '# A\n' } })
  write(dir, '.abmh/harness.yaml', 'docsDir: notes\n')
  assert.equal(sh(dir, 'com-01.sh').code, 1)
})

test('COM-02 fails on a MEMORY over 40 KB or an entry over 600 bytes', () => {
  const big = project({ files: { '00-docs/MEMORY.md': `${doc()}${'- x\n'.repeat(11000)}` } })
  assert.match(sh(big, 'com-02.sh').out, /MEMORY\.md: \d+ bytes, the cap is 40960/)
  const long = project({ files: { '00-docs/MEMORY.md': `${doc()}- ${'a'.repeat(700)}\n- short\n` } })
  const result = sh(long, 'com-02.sh')
  assert.deepEqual([result.code, result.out.trim()], [1, '00-docs/MEMORY.md:7 entry over 600 bytes'])
  assert.equal(sh(project({ files: { '00-docs/MEMORY.md': `${doc()}- short\n` } }), 'com-02.sh').code, 0)
  assert.equal(sh(project(), 'com-02.sh').code, 2)
})

test('COM-03 needs a GLOSSARY.md in the docs folder', () => {
  assert.equal(sh(project({ files: { '00-docs/STATUS.md': doc() } }), 'com-03.sh').code, 1)
  assert.equal(sh(project({ files: { '00-docs/GLOSSARY.md': doc() } }), 'com-03.sh').code, 0)
  assert.equal(sh(project(), 'com-03.sh').code, 2)
})

const committed = (files, date = '2026-11-10') => {
  const dir = project({ files })
  const git = (...args) => spawnSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { env: { ...process.env, GIT_COMMITTER_DATE: `${date}T00:00:00`, GIT_AUTHOR_DATE: `${date}T00:00:00` } })
  git('add', '-A')
  git('commit', '-qm', 'base')
  return dir
}

test('COM-04 fails when STATUS was reviewed over 30 days ago and commits came after', () => {
  const dir = committed({ '00-docs/STATUS.md': doc() })
  assert.equal(sh(dir, 'com-04.sh', [], { ABMH_TODAY: '2026-11-20' }).code, 0)
  const bad = sh(dir, 'com-04.sh', [], { ABMH_TODAY: '2026-12-15' })
  assert.deepEqual([bad.code, bad.out.trim()], [1, '00-docs/STATUS.md: last reviewed 2026-11-01, 44 days ago, with commits since'])
})

test('COM-04 passes when no commit came after the review date, and NOT RUN without git or with placeholders', () => {
  const dir = committed({ '00-docs/STATUS.md': doc().replace('2026-11-01', '2026-10-05') }, '2026-10-01')
  assert.equal(sh(dir, 'com-04.sh', [], { ABMH_TODAY: '2026-12-31' }).code, 0)
  const noGit = project({ git: false, files: { '00-docs/STATUS.md': doc() } })
  assert.equal(sh(noGit, 'com-04.sh', [], { ABMH_TODAY: '2026-12-31' }).code, 2)
  const placeholder = project({ files: { '00-docs/STATUS.md': doc().replace('2026-11-01', 'YYYY-MM-DD') } })
  const result = sh(placeholder, 'com-04.sh')
  assert.deepEqual([result.code, result.out.trim()], [2, '00-docs/STATUS.md: Last reviewed is not filled in yet'])
})

test('COM-04 does not count commits made on the review day itself', () => {
  const dir = committed({ '00-docs/STATUS.md': doc() }, '2026-11-01')
  assert.equal(sh(dir, 'com-04.sh', [], { ABMH_TODAY: '2026-12-31' }).code, 0)
})

test('COM-04 fails on a STATUS or LEEME with no Last reviewed line, and reads the Spanish form', () => {
  const missing = project({ files: { '00-docs/LEEME.md': '# LEEME\n' } })
  assert.equal(sh(missing, 'com-04.sh').code, 1)
  const spanish = committed({ '00-docs/LEEME.md': '# LEEME\n\n> Última revisión: 2026-11-01\n' })
  assert.equal(sh(spanish, 'com-04.sh', [], { ABMH_TODAY: '2026-12-15' }).code, 1)
})
