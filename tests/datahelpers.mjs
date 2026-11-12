import { project, write } from './checkhelpers.mjs'

export const HEADER = ['-- spec: SPEC-ABMS-012', '-- local-test: yes', '-- backup: dump of 2026-11-11', '-- rollback: drop table t;'].join('\n')

export const migration = (body = 'create table t (id int);', header = HEADER) => `${header}\n${body}\n`

export function migrationProject({ files = {}, yaml = '', registry = true } = {}) {
  const dir = project({ files })
  write(dir, '.abmh/harness.yaml', `version: x\nprofile: universal\ndocsDir: 00-docs\n${yaml}`)
  if (registry) write(dir, '00-docs/data/MIGRATIONS.md', `Audience: both\n\n> **Summary:** registry.\n\n${Object.keys(files).filter((name) => name.endsWith('.sql')).map((name) => name.split('/').pop()).join('\n')}\n`)
  return dir
}
