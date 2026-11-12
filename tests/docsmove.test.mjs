import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, exists, makeRepo, planId, read, snapshot, tempDir } from './helpers.mjs'

const NOW = new Date('2026-11-11T10:15:00Z')
const TAR = (dir) => fs.readdirSync(dir).find((name) => name.endsWith('.tar.gz'))

function project(extra = {}) {
  const dir = makeRepo(
    {
      'shared-domain/MEMORY.md': 'see shared-domain/GAPS.md and shared-domain/specs/\n',
      'shared-domain/GAPS.md': '# gaps\n',
      'shared-domain/specs/SPEC-001.md': 'link: ../MEMORY.md and shared-domain/specs/\n',
      'AGENTS.md': 'read `shared-domain/MEMORY.md` first; the shared-domain folder is old\n',
      'opencode.json': '{"instructions":["shared-domain/PROJECT_CONTEXT.md"]}\n',
      'src/app.ts': 'const docs = "shared-domain/specs/"\n',
      '.env': 'KEY=shared-domain/secret\n',
      'node_modules/dep/readme.md': 'shared-domain/ in a dependency\n',
      'notes.txt': 'shared-domain/ in a txt\n',
      ...extra,
    },
    { git: false },
  )
  return dir
}

const plan = (dir, backup, more = []) => abmh(dir, ['migrate', '--backup-dir', backup, ...more])
const accept = (dir, backup, id, inject = { now: NOW }) => abmh(dir, ['migrate', '--backup-dir', backup, '--accept-plan', id], inject)

test('the plan writes nothing and lists replacements, kept mentions and skipped files', () => {
  const dir = project()
  fs.writeFileSync(path.join(dir, 'blob.md'), Buffer.from([0x73, 0x00, 0x68]))
  fs.symlinkSync('AGENTS.md', path.join(dir, 'link.md'))
  const backup = path.join(tempDir(), 'bk')
  const before = snapshot(dir)
  const result = plan(dir, backup)
  assert.equal(result.code, 0)
  assert.match(result.out, /plan id: [0-9a-f]{64}/)
  assert.match(result.out, /rename shared-domain\/ -> 00-docs\//)
  assert.match(result.out, /edit shared-domain\/MEMORY.md \(2 replacements\)/)
  assert.match(result.out, /edit AGENTS.md \(1 replacement\)/)
  assert.match(result.out, /edit opencode.json/)
  assert.match(result.out, /edit src\/app.ts/)
  assert.match(result.out, /mention kept AGENTS.md \(1, no slash after the name; check it by hand\) line 1: read `shared-domain\/MEMORY.md` first; the shared-domain folder is old/)
  assert.match(result.out, /skip blob.md - binary/)
  assert.match(result.out, /skip link.md - symbolic link/)
  assert.doesNotMatch(result.out, /\.env|node_modules|notes\.txt/)
  assert.deepEqual(snapshot(dir), before)
  assert.equal(exists(path.dirname(backup), 'bk'), false)
})

test('the default backup folder is _backups next to the project', () => {
  const dir = project()
  assert.match(abmh(dir, ['migrate']).out, new RegExp(`save ${path.dirname(dir)}/_backups/`))
})

test('conflicts stop with exit 4 and write nothing', () => {
  const backup = path.join(tempDir(), 'bk')
  const busy = project({ '00-docs/mine.md': 'x' })
  const before = snapshot(busy)
  assert.equal(plan(busy, backup).code, 4)
  assert.deepEqual(snapshot(busy), before)
  const none = makeRepo({ 'a.md': 'x' }, { git: false })
  assert.equal(plan(none, backup).code, 4)
  const inside = project()
  const result = abmh(inside, ['migrate', '--backup-dir', path.join(inside, '_backups')])
  assert.equal(result.code, 4)
  assert.match(result.err, /inside the project/)
})

test('the plan id changes when a file changes and a stale id is refused with exit 3', () => {
  const dir = project()
  const backup = path.join(tempDir(), 'bk')
  const first = planId(plan(dir, backup).out)
  fs.appendFileSync(path.join(dir, 'AGENTS.md'), 'more shared-domain/ text\n')
  assert.notEqual(planId(plan(dir, backup).out), first)
  const result = accept(dir, backup, first)
  assert.equal(result.code, 3)
  assert.ok(exists(dir, 'shared-domain'))
  assert.equal(exists(path.dirname(backup), 'bk'), false)
})

test('apply saves a verified backup, renames, rewrites text and leaves skipped paths intact', () => {
  const dir = project()
  fs.chmodSync(path.join(dir, 'AGENTS.md'), 0o600)
  const backup = path.join(tempDir(), 'bk')
  const envBefore = read(dir, '.env')
  const result = accept(dir, backup, planId(plan(dir, backup).out))
  assert.equal(result.code, 0, result.err)
  const tar = TAR(backup)
  assert.match(tar, /^abmh-.*-20261111T101500\.tar\.gz$|-20261111T101500\.tar\.gz$/)
  assert.ok(fs.existsSync(path.join(backup, tar.replace('.tar.gz', '.json'))))
  assert.equal(exists(dir, 'shared-domain'), false)
  assert.equal(read(dir, '00-docs/MEMORY.md'), 'see 00-docs/GAPS.md and 00-docs/specs/\n')
  assert.equal(read(dir, '00-docs/specs/SPEC-001.md'), 'link: ../MEMORY.md and 00-docs/specs/\n')
  assert.equal(read(dir, 'AGENTS.md'), 'read `00-docs/MEMORY.md` first; the shared-domain folder is old\n')
  assert.equal(read(dir, 'opencode.json'), '{"instructions":["00-docs/PROJECT_CONTEXT.md"]}\n')
  assert.equal(read(dir, '.env'), envBefore)
  assert.equal(read(dir, 'node_modules/dep/readme.md'), 'shared-domain/ in a dependency\n')
  assert.equal(read(dir, 'notes.txt'), 'shared-domain/ in a txt\n')
  assert.equal(fs.statSync(path.join(dir, 'AGENTS.md')).mode & 0o777, 0o600)
  const listing = execFileSync('tar', ['-tzf', path.join(backup, tar)], { encoding: 'utf8' })
  assert.match(listing, /shared-domain\/MEMORY.md/)
  assert.match(listing, /AGENTS.md/)
  assert.doesNotMatch(listing, /\.env|node_modules/)
  const extracted = tempDir()
  execFileSync('tar', ['-xzf', path.join(backup, tar), '-C', extracted])
  assert.equal(read(extracted, 'shared-domain/MEMORY.md'), 'see shared-domain/GAPS.md and shared-domain/specs/\n')
  assert.match(read(extracted, 'AGENTS.md'), /`shared-domain\/MEMORY.md`/)
})

test('after apply the project has no shared-domain/ slash reference left in migrated text files', () => {
  const dir = project()
  const backup = path.join(tempDir(), 'bk')
  accept(dir, backup, planId(plan(dir, backup).out))
  for (const rel of ['AGENTS.md', 'opencode.json', 'src/app.ts', '00-docs/MEMORY.md', '00-docs/specs/SPEC-001.md']) assert.doesNotMatch(read(dir, rel), /shared-domain\//, rel)
  assert.match(plan(dir, backup).err, /nothing to migrate/)
  const again = abmh(dir, ['migrate', '--backup-dir', backup])
  assert.equal(again.code, 4)
})

test('restore returns the project to its saved state and moves 00-docs aside without deleting', () => {
  const dir = project()
  const before = snapshot(dir)
  const backup = path.join(tempDir(), 'bk')
  accept(dir, backup, planId(plan(dir, backup).out))
  fs.appendFileSync(path.join(dir, '00-docs/GAPS.md'), 'added after\n')
  const tar = path.join(backup, TAR(backup))
  const restore = abmh(dir, ['migrate', '--restore', tar])
  assert.equal(restore.code, 0, restore.err)
  assert.match(restore.out, /move 00-docs\/ aside to 00-docs.restored-20261111T101500\//)
  const done = abmh(dir, ['migrate', '--restore', tar, '--accept-plan', planId(restore.out)])
  assert.equal(done.code, 0, done.err)
  assert.match(read(dir, '00-docs.restored-20261111T101500/GAPS.md'), /added after/)
  fs.rmSync(path.join(dir, '00-docs.restored-20261111T101500'), { recursive: true })
  assert.deepEqual(snapshot(dir), before)
})

test('restore lists files outside shared-domain that changed after the migration', () => {
  const dir = project()
  const backup = path.join(tempDir(), 'bk')
  accept(dir, backup, planId(plan(dir, backup).out))
  fs.appendFileSync(path.join(dir, 'AGENTS.md'), 'edited later\n')
  const out = abmh(dir, ['migrate', '--restore', path.join(backup, TAR(backup))]).out
  assert.match(out, /\[changed since the migration\]\n {2}AGENTS.md differs/)
})

test('restore refuses a backup of another project, a stale id and an existing shared-domain', () => {
  const dir = project()
  const other = project()
  const backup = path.join(tempDir(), 'bk')
  accept(dir, backup, planId(plan(dir, backup).out))
  const tar = path.join(backup, TAR(backup))
  assert.equal(abmh(other, ['migrate', '--restore', tar]).code, 4)
  const first = planId(abmh(dir, ['migrate', '--restore', tar]).out)
  fs.appendFileSync(path.join(dir, 'AGENTS.md'), 'later\n')
  assert.equal(abmh(dir, ['migrate', '--restore', tar, '--accept-plan', first]).code, 3)
  fs.mkdirSync(path.join(dir, 'shared-domain'))
  assert.equal(abmh(dir, ['migrate', '--restore', tar]).code, 4)
  assert.equal(abmh(dir, ['migrate', '--restore', path.join(backup, 'missing.tar.gz')]).code, 4)
})

test('flags are checked: --docs-dir does not apply to migrate and --restore only applies to migrate', () => {
  const dir = project()
  assert.equal(abmh(dir, ['migrate', '--docs-dir', 'x']).code, 2)
  assert.equal(abmh(dir, ['init', '--restore', 'x']).code, 2)
  assert.equal(abmh(dir, ['update', '--backup-dir', 'x']).code, 2)
  assert.equal(abmh(dir, ['migrate', '--profile', 'universal']).code, 2)
})

test('files that are not valid UTF-8 are skipped and keep their bytes', () => {
  const dir = project()
  const bytes = Buffer.concat([Buffer.from('caf'), Buffer.from([0xe9]), Buffer.from(' shared-domain/A.md\n')])
  fs.writeFileSync(path.join(dir, 'latin1.md'), bytes)
  const backup = path.join(tempDir(), 'bk')
  const out = plan(dir, backup).out
  assert.match(out, /skip latin1.md - not valid UTF-8/)
  accept(dir, backup, planId(out))
  assert.deepEqual(fs.readFileSync(path.join(dir, 'latin1.md')), bytes)
})

test('directories named .env* are never opened', () => {
  const dir = project({ '.envs/c.json': '{"p":"shared-domain/x"}\n', '.env.d/n.md': 'shared-domain/y\n' })
  const out = plan(dir, path.join(tempDir(), 'bk')).out
  assert.doesNotMatch(out, /\.env/)
})

test('a non-ASCII file name does not break the backup check', () => {
  const dir = project({ 'caf\u00e9 \u00fc.md': 'see shared-domain/GAPS.md\n' })
  const backup = path.join(tempDir(), 'bk')
  const result = accept(dir, backup, planId(plan(dir, backup).out))
  assert.equal(result.code, 0, result.err)
  assert.equal(read(dir, 'caf\u00e9 \u00fc.md'), 'see 00-docs/GAPS.md\n')
})

test('names with spaces or a leading dash are backed up and rewritten', () => {
  const dir = project({ '-odd name.md': 'shared-domain/a\n', 'sp ace/x y.md': 'shared-domain/b\n' })
  const backup = path.join(tempDir(), 'bk')
  const result = accept(dir, backup, planId(plan(dir, backup).out))
  assert.equal(result.code, 0, result.err)
  assert.equal(read(dir, '-odd name.md'), '00-docs/a\n')
  assert.equal(read(dir, 'sp ace/x y.md'), '00-docs/b\n')
})

test('a backup folder reached through a symlink into the project is refused', () => {
  const dir = project()
  const link = path.join(tempDir(), 'link')
  fs.symlinkSync(dir, link)
  const result = abmh(dir, ['migrate', '--backup-dir', path.join(link, '_bk')])
  assert.equal(result.code, 4)
  assert.match(result.err, /inside the project/)
})

test('text that merely ends in shared-domain/ is not rewritten', () => {
  const dir = project({ 'x.md': 'my-shared-domain/Y and word_shared-domain/Z and shared-domain/ok\n' })
  const backup = path.join(tempDir(), 'bk')
  accept(dir, backup, planId(plan(dir, backup).out))
  assert.equal(read(dir, 'x.md'), 'my-shared-domain/Y and word_shared-domain/Z and 00-docs/ok\n')
})

test('CRLF and a BOM survive the rewrite', () => {
  const text = '\ufeffline shared-domain/a\r\nline two\r\n'
  const dir = project({ 'win.md': text })
  const backup = path.join(tempDir(), 'bk')
  accept(dir, backup, planId(plan(dir, backup).out))
  assert.equal(read(dir, 'win.md'), text.replace('shared-domain/', '00-docs/'))
})

test('a file changed after the plan is refused before anything is renamed and leaves no backup', () => {
  const dir = project()
  const backup = path.join(tempDir(), 'bk')
  const id = planId(plan(dir, backup).out)
  fs.writeFileSync(path.join(dir, 'opencode.json'), '{"instructions":["shared-domain/other.md"]}\n')
  assert.equal(accept(dir, backup, id).code, 3)
  assert.ok(exists(dir, 'shared-domain'))
  assert.equal(exists(dir, '00-docs'), false)
})

test('nothing in the project is deleted by apply except through the rename', () => {
  const dir = project()
  const before = snapshot(dir).tree.filter((line) => line.startsWith('file ')).map((line) => line.split(' ')[1]).map((rel) => (rel.startsWith('shared-domain/') ? `00-docs/${rel.slice(14)}` : rel))
  const backup = path.join(tempDir(), 'bk')
  accept(dir, backup, planId(plan(dir, backup).out))
  const after = new Set(snapshot(dir).tree.filter((line) => line.startsWith('file ')).map((line) => line.split(' ')[1]))
  for (const rel of before) assert.ok(after.has(rel), rel)
})
