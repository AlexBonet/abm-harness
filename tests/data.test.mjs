import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { sh, write } from './checkhelpers.mjs'
import { HEADER, migration, migrationProject } from './datahelpers.mjs'

const DIR = 'supabase/migrations'
const file = (name, text = migration()) => ({ [`${DIR}/${name}`]: text })

test('every MIG check is NOT RUN without a migrations folder', () => {
  for (const script of ['mig-01.sh', 'mig-02.sh']) {
    const result = sh(migrationProject({ files: { 'README.md': 'x' } }), script)
    assert.equal(result.code, 2, script)
    assert.match(result.out, /no migrations folder/)
  }
})

test('migrations_dir in harness.yaml overrides the usual folders', () => {
  const dir = migrationProject({ files: { 'db/sql/001_a.sql': migration() }, yaml: 'migrations_dir: db/sql/\n' })
  assert.equal(sh(dir, 'mig-01.sh').code, 0)
})

test('an invalid pattern or migrations_from is NOT RUN with the reason', () => {
  const pattern = sh(migrationProject({ files: file('001_a.sql'), yaml: 'migration_pattern: name.sql\n' }), 'mig-01.sh')
  assert.equal(pattern.code, 2)
  assert.match(pattern.out, /migration_pattern/)
  const from = sh(migrationProject({ files: file('001_a.sql'), yaml: 'migrations_from: soon\n' }), 'mig-02.sh')
  assert.equal(from.code, 2)
  assert.match(from.out, /migrations_from/)
})

test('MIG-01 passes with the four header fields', () => {
  assert.equal(sh(migrationProject({ files: { ...file('001_a.sql'), ...file('002_b.sql') } }), 'mig-01.sh').code, 0)
})

test('MIG-01 names the file and the missing or invalid field', () => {
  const cases = [
    ['-- spec: SPEC-1\n-- local-test: yes\n-- backup: x', 'rollback'],
    ['-- spec: soon\n-- local-test: yes\n-- backup: x\n-- rollback: y', 'spec'],
    ['-- spec: SPEC-1\n-- local-test: no\n-- backup: x\n-- rollback: y', 'local-test'],
    ['-- spec: SPEC-1\n-- local-test: yes\n-- backup:\n-- rollback: y', 'backup'],
  ]
  for (const [header, field] of cases) {
    const result = sh(migrationProject({ files: file('003_c.sql', migration('select 1;', header)) }), 'mig-01.sh')
    assert.equal(result.code, 1, field)
    assert.match(result.out, new RegExp(`003_c\\.sql: missing or invalid field ${field}:`))
  }
})

test('MIG-01 only reads the leading comment block', () => {
  const late = `select 1;\n${HEADER}\n`
  const result = sh(migrationProject({ files: file('001_a.sql', late) }), 'mig-01.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /001_a\.sql: missing or invalid field spec:/)
  assert.equal(sh(migrationProject({ files: file('001_a.sql', `\n${HEADER}\nselect 1;\n`) }), 'mig-01.sh').code, 0)
})

test('MIG-01 skips legacy files below migrations_from and honours the dev_NNN pattern', () => {
  const files = { ...file('dev_001_old.sql', 'select 1;\n'), ...file('dev_194_new.sql') }
  const yaml = 'migration_pattern: dev_NNN_name.sql\nmigrations_from: 194\n'
  assert.equal(sh(migrationProject({ files, yaml }), 'mig-01.sh').code, 0)
  assert.equal(sh(migrationProject({ files, yaml: 'migration_pattern: dev_NNN_name.sql\n' }), 'mig-01.sh').code, 1)
})

test('MIG-02 passes for a consecutive registered series, also with dev_NNN names', () => {
  assert.equal(sh(migrationProject({ files: { ...file('001_a.sql'), ...file('002_b.sql'), ...file('003_c.sql') } }), 'mig-02.sh').code, 0)
  const yaml = 'migration_pattern: dev_NNN_name.sql\n'
  assert.equal(sh(migrationProject({ files: { ...file('dev_001_a.sql'), ...file('dev_002_b.sql') }, yaml }), 'mig-02.sh').code, 0)
})

test('MIG-02 fails on a gap, a repeat, a name off the pattern and a missing registry entry', () => {
  const gap = sh(migrationProject({ files: { ...file('001_a.sql'), ...file('003_c.sql') } }), 'mig-02.sh')
  assert.equal(gap.code, 1)
  assert.match(gap.out, /003_c\.sql: expected number 2/)
  const repeat = sh(migrationProject({ files: { ...file('001_a.sql'), ...file('001_b.sql') } }), 'mig-02.sh')
  assert.match(repeat.out, /001_b\.sql: number 1 is repeated/)
  const name = sh(migrationProject({ files: { ...file('001_a.sql'), ...file('20260101120000_x.sql') } }), 'mig-02.sh')
  assert.match(name.out, /20260101120000_x\.sql: does not follow the pattern NNN_name\.sql/)
  const partial = migrationProject({ files: { ...file('001_a.sql'), ...file('002_b.sql') }, registry: false })
  write(partial, '00-docs/data/MIGRATIONS.md', 'Audience: both\n\n> **Summary:** r.\n\n001_a.sql\n')
  const missing = sh(partial, 'mig-02.sh')
  assert.equal(missing.code, 1)
  assert.match(missing.out, /002_b\.sql: not listed in 00-docs\/data\//)
  assert.doesNotMatch(missing.out, /001_a/)
  const noRegistry = sh(migrationProject({ files: file('001_a.sql'), registry: false }), 'mig-02.sh')
  assert.match(noRegistry.out, /001_a\.sql: not listed in 00-docs\/data\//)
})

test('MIG-02 counts from migrations_from and ignores files below it', () => {
  const files = { ...file('001_old.sql'), ...file('005_old.sql'), ...file('010_a.sql'), ...file('011_b.sql') }
  assert.equal(sh(migrationProject({ files, yaml: 'migrations_from: 10\n' }), 'mig-02.sh').code, 0)
  assert.equal(sh(migrationProject({ files }), 'mig-02.sh').code, 1)
})

const withHeader = (extra, body) => migration(body, `${HEADER}\n${extra}`)
const dropColumn = 'alter table t drop column old;'

test('MIG-03 passes migrations without destructive statements and ignores comments', () => {
  const files = { ...file('001_a.sql', migration('create table t (id int, old int);')), ...file('002_b.sql', migration('-- drop table t;\nalter table t add column fresh int; -- never drop column old here')) }
  assert.equal(sh(migrationProject({ files }), 'mig-03.sh').code, 0)
})

test('MIG-03 reports DROP COLUMN, DROP TABLE and a type change without expands', () => {
  const statements = [dropColumn, 'DROP TABLE t;', 'alter table t\n  alter column id\n  type bigint;', 'ALTER TABLE t ALTER COLUMN id SET DATA TYPE text;']
  for (const body of statements) {
    const result = sh(migrationProject({ files: { ...file('001_a.sql'), ...file('002_b.sql', migration(body)) } }), 'mig-03.sh')
    assert.equal(result.code, 1, body)
    assert.match(result.out, /002_b\.sql: .*-- expands:/)
  }
})

test('MIG-03 passes when expands names an earlier migration that added the replacement', () => {
  const files = { ...file('001_a.sql', migration('create table t (id int);')), ...file('002_b.sql', migration('alter table t add column fresh int;')), ...file('003_c.sql', withHeader('-- expands: 002_b.sql', dropColumn)) }
  assert.equal(sh(migrationProject({ files }), 'mig-03.sh').code, 0)
})

test('MIG-03 rejects an expands that is missing, later or adds nothing', () => {
  const base = { ...file('001_a.sql', migration('select 1;')), ...file('002_b.sql', migration('alter table t add column fresh int;')) }
  const cases = [['-- expands: 009_x.sql', {}], ['-- expands: 001_a.sql', {}], ['-- expands: 004_d.sql', file('004_d.sql', migration('alter table t add column z int;'))]]
  for (const [extra, more] of cases) {
    const result = sh(migrationProject({ files: { ...base, ...more, ...file('003_c.sql', withHeader(extra, dropColumn)) } }), 'mig-03.sh')
    assert.equal(result.code, 1, extra)
    assert.match(result.out, /003_c\.sql: expands: .* is not an earlier migration that adds a column or table/)
  }
})

test('MIG-03 skips legacy files', () => {
  assert.equal(sh(migrationProject({ files: file('001_a.sql', migration(dropColumn)), yaml: 'migrations_from: 2\n' }), 'mig-03.sh').code, 0)
})

test('MIG-04 is NOT RUN with the exact warning for a new migration that touches RLS or grants', () => {
  const statements = ['create policy p on t for select using (true);', 'alter table t enable row level security;', 'GRANT select ON t TO anon;', 'revoke all on t from anon;', 'alter default privileges in schema public grant all on tables to x;']
  for (const body of statements) {
    const result = sh(migrationProject({ files: file('001_a.sql', migration(body)) }), 'mig-04.sh')
    assert.equal(result.code, 2, body)
    assert.match(result.out, /Seguridad gate and tier alto required: supabase\/migrations\/001_a\.sql/)
  }
})

test('MIG-04 passes harmless migrations, skips legacy ones and files unchanged since the base', () => {
  assert.equal(sh(migrationProject({ files: file('001_a.sql') }), 'mig-04.sh').code, 0)
  const policy = migration('create policy p on t for select using (true);')
  assert.equal(sh(migrationProject({ files: file('001_a.sql', policy), yaml: 'migrations_from: 2\n' }), 'mig-04.sh').code, 0)
  const committed = migrationProject({ files: file('001_a.sql', policy) })
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: committed })
  git('add', '.abmh')
  git('commit', '-q', '-m', 'base')
  git('add', '.')
  git('commit', '-q', '-m', 'migration')
  assert.equal(sh(committed, 'mig-04.sh').code, 0)
  assert.equal(sh(committed, 'mig-04.sh', [], { ABMH_BASE: 'HEAD~1' }).code, 2)
})

test('MIG-04 is NOT RUN outside a git repository', () => {
  const result = sh(migrationProject({ files: file('001_a.sql') }), 'mig-04.sh', [], { GIT_DIR: '/nonexistent' })
  assert.equal(result.code, 2)
})

test('MIG-02 treats files outside the pattern as legacy when their number is below migrations_from', () => {
  const files = { ...file('001_old.sql'), ...file('010_old2.sql'), ...file('rollback_189_x.sql'), ...file('dev_190_a.sql'), ...file('dev_191_b.sql') }
  const yaml = 'migration_pattern: dev_NNN_name.sql\nmigrations_from: 190\n'
  assert.equal(sh(migrationProject({ files, yaml }), 'mig-02.sh').code, 0)
  const stamped = { ...files, ...file('20260101120000_x.sql') }
  assert.match(sh(migrationProject({ files: stamped, yaml }), 'mig-02.sh').out, /20260101120000_x\.sql: does not follow/)
})

test('a ./ or doubled slash in migrations_dir does not hide a sensitive migration from MIG-04', () => {
  const files = { 'migrations/001_a.sql': migration('grant select on t to anon;') }
  for (const value of ['./migrations', 'migrations//', './migrations/']) {
    assert.equal(sh(migrationProject({ files, yaml: `migrations_dir: ${value}\n` }), 'mig-04.sh').code, 2, value)
  }
})

test('MIG-01 and MIG-03 accept CRLF and a BOM in the header', () => {
  const crlf = migration('create table t (id int);', HEADER.replaceAll('\n', '\r\n')).replaceAll('\n', '\r\n')
  assert.equal(sh(migrationProject({ files: file('001_a.sql', crlf) }), 'mig-01.sh').code, 0)
  assert.equal(sh(migrationProject({ files: file('001_a.sql', `\ufeff${migration()}`) }), 'mig-01.sh').code, 0)
  const expands = { ...file('001_a.sql', migration('create table t (id int);')), ...file('002_b.sql', migration(dropColumn, `${HEADER}\n-- expands: 001_a.sql`).replaceAll('\n', '\r\n')) }
  assert.equal(sh(migrationProject({ files: expands }), 'mig-03.sh').code, 0)
})

test('migrations_from 0 counts 000 as the first number', () => {
  assert.equal(sh(migrationProject({ files: { ...file('000_init.sql'), ...file('001_a.sql') }, yaml: 'migrations_from: 0\n' }), 'mig-02.sh').code, 0)
})

test('MIG-01, MIG-03 and MIG-04 are NOT RUN when no file matches the pattern', () => {
  const files = file('20260101120000_x.sql')
  for (const script of ['mig-01.sh', 'mig-03.sh', 'mig-04.sh']) {
    const result = sh(migrationProject({ files }), script)
    assert.equal(result.code, 2, script)
    assert.match(result.out, /no migration file matches the pattern NNN_name\.sql/)
  }
})

test('MIG-03 ignores block comments and catches a type change without COLUMN', () => {
  assert.equal(sh(migrationProject({ files: file('001_a.sql', migration('/* drop table x */ select 1;')) }), 'mig-03.sh').code, 0)
  assert.equal(sh(migrationProject({ files: file('001_a.sql', migration('alter table t alter a type text;')) }), 'mig-03.sh').code, 1)
})

test('MIG-02 matches a registry entry as a whole name', () => {
  const dir = migrationProject({ files: file('001_a.sql'), registry: false })
  write(dir, '00-docs/data/M.md', 'Audience: both\n\n> **Summary:** r.\n\nx001_a.sql\n')
  assert.equal(sh(dir, 'mig-02.sh').code, 1)
})
