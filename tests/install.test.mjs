import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { START } from '../src/block.mjs'
import { abmh, exists, install, makeRepo, manifestOf, read, removeAll, snapshot } from './helpers.mjs'

const hooksPath = (dir) => {
  try {
    return execFileSync('git', ['-C', dir, 'config', '--local', '--get', 'core.hooksPath'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

test('install exposes skills, agents and the block; second run changes nothing', () => {
  const dir = makeRepo({ 'AGENTS.md': '# Mine\n' })
  assert.equal(install(dir).code, 0)
  assert.ok(fs.realpathSync(path.join(dir, '.claude/skills/spec')).endsWith('.abmh/skills/spec'))
  assert.ok(exists(dir, '.claude/agents/abms-review-risk.md'))
  assert.ok(exists(dir, '.agents/skills/spec/SKILL.md'))
  assert.ok(!exists(dir, '.agents/skills/abms-spec-review'))
  assert.ok(read(dir, 'AGENTS.md').startsWith('# Mine\n'))
  assert.ok(read(dir, 'GEMINI.md').includes(START))
  const after = snapshot(dir)
  const again = abmh(dir, ['init'])
  assert.match(again.out, /nothing to do/)
  assert.deepEqual(snapshot(dir), after)
})

test('one assistant gets only its own files', () => {
  const dir = makeRepo()
  install(dir, ['--assistants', 'codex'])
  assert.ok(exists(dir, '.agents/skills/spec'))
  assert.ok(!exists(dir, '.claude'))
  assert.ok(!exists(dir, 'GEMINI.md'))
  assert.ok(exists(dir, 'AGENTS.md'))
})

test('missing AGENTS.md is created; CLAUDE.md alone is left untouched', () => {
  const dir = makeRepo({ 'CLAUDE.md': '# Claude only\n' })
  install(dir)
  assert.equal(read(dir, 'CLAUDE.md'), '# Claude only\n')
  assert.ok(read(dir, 'AGENTS.md').startsWith(START))
})

test('CLAUDE.md symlinked to AGENTS.md carries the block once', () => {
  const dir = makeRepo({ 'AGENTS.md': '# Shared\n' })
  fs.symlinkSync('AGENTS.md', path.join(dir, 'CLAUDE.md'))
  install(dir)
  assert.equal(read(dir, 'CLAUDE.md').split(START).length - 1, 1)
  assert.ok(fs.lstatSync(path.join(dir, 'CLAUDE.md')).isSymbolicLink())
})

test('unbalanced or duplicate markers give exit 4', () => {
  const half = makeRepo({ 'AGENTS.md': `${START}\nno end\n` })
  assert.equal(abmh(half, ['init']).code, 4)
  const twice = makeRepo({ 'AGENTS.md': '<!-- abmh:start -->\n<!-- abmh:end -->\n<!-- abmh:start -->\n<!-- abmh:end -->\n' })
  assert.equal(abmh(twice, ['init']).code, 4)
})

test('CRLF files keep their line endings', () => {
  const dir = makeRepo({ 'AGENTS.md': '# Win\r\nline\r\n' })
  install(dir)
  assert.ok(!/[^\r]\n/.test(read(dir, 'AGENTS.md')))
  removeAll(dir)
  assert.equal(read(dir, 'AGENTS.md'), '# Win\r\nline\r\n')
})

test('the hook is installed through core.hooksPath and is executable', () => {
  const dir = makeRepo()
  install(dir)
  assert.equal(hooksPath(dir), '.abmh/hooks')
  assert.ok((fs.statSync(path.join(dir, '.abmh/hooks/pre-push')).mode & 0o111) !== 0)
  assert.equal(manifestOf(dir).entries.find((entry) => entry.kind === 'gitconfig').previous, null)
})

const HOOK_SKIPS = [
  ['core.hooksPath already set', () => makeRepo(), (dir) => execFileSync('git', ['-C', dir, 'config', 'core.hooksPath', 'custom'])],
  ['own hook file', () => makeRepo({ '.git/hooks/pre-commit': '#!/bin/sh\n' }), () => {}],
  ['husky', () => makeRepo({ '.husky/pre-commit': '' }), () => {}],
  ['lefthook', () => makeRepo({ 'lefthook.yml': '' }), () => {}],
]

for (const [name, build, prepare] of HOOK_SKIPS) {
  test(`hook is skipped and listed: ${name}`, () => {
    const dir = build()
    prepare(dir)
    const plan = abmh(dir, ['init'])
    assert.match(plan.out, /\[hooks\]\n {2}skip git hook/)
    install(dir)
    assert.ok(!exists(dir, '.abmh/hooks'))
    assert.notEqual(hooksPath(dir), '.abmh/hooks')
  })
}

test('--no-hooks and a non-git folder skip the hook', () => {
  const dir = makeRepo()
  install(dir, ['--no-hooks'])
  assert.equal(hooksPath(dir), null)
  const plain = makeRepo({}, { git: false })
  assert.match(abmh(plain, ['init']).out, /not a git repository/)
  assert.equal(install(plain).code, 0)
})

test('an occupied link path is skipped, never replaced', () => {
  const dir = makeRepo({ '.claude/skills/spec/SKILL.md': 'my own spec skill' })
  assert.match(abmh(dir, ['init']).out, /skip .claude\/skills\/spec - path occupied/)
  install(dir)
  assert.equal(read(dir, '.claude/skills/spec/SKILL.md'), 'my own spec skill')
  assert.ok(exists(dir, '.claude/skills/abms-spec-review'))
})

test('a failing symlink falls back to a copy, and remove cleans it', () => {
  const dir = makeRepo()
  const before = snapshot(dir)
  install(dir, [], {
    symlink: () => {
      throw new Error('symlinks not allowed')
    },
  })
  assert.ok(fs.lstatSync(path.join(dir, '.claude/skills/spec')).isDirectory())
  assert.ok(exists(dir, '.claude/skills/spec/SKILL.md'))
  removeAll(dir)
  assert.deepEqual(snapshot(dir), before)
})

test('installed files name nobody and carry no mods', () => {
  const dir = makeRepo()
  install(dir, ['--lang', 'en', '--profile', 'abm-estricto'])
  const files = fs.readdirSync(path.join(dir, '.abmh'), { recursive: true }).filter((rel) => fs.statSync(path.join(dir, '.abmh', rel)).isFile())
  assert.ok(files.length > 30)
  const offenders = files.filter((rel) => /\balex\b|abms-(cabina|guardia|migraciones)/i.test(read(dir, `.abmh/${rel}`)))
  assert.deepEqual(offenders, [])
})

test('the installer never touches secret files', () => {
  const dir = makeRepo({ '.env': 'KEY=secret\n' })
  install(dir)
  assert.equal(read(dir, '.env'), 'KEY=secret\n')
  assert.ok(!JSON.stringify(manifestOf(dir)).includes('.env'))
})

test('accepting on an installed project says nothing to do', () => {
  const dir = makeRepo()
  install(dir)
  const result = abmh(dir, ['init', '--accept-plan', 'anything'])
  assert.equal(result.code, 0)
  assert.match(result.out, /nothing to do/)
})
