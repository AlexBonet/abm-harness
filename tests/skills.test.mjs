import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, exists, install, makeRepo, read, removeAll, snapshot } from './helpers.mjs'

const NEW = ['grill', 'wizard', 'diagnose']

test('the three skills install, link for every assistant and stay put on a second run', () => {
  const dir = makeRepo()
  assert.equal(install(dir).code, 0)
  for (const name of NEW) {
    assert.ok(exists(dir, `.abmh/skills/${name}/SKILL.md`))
    assert.ok(fs.realpathSync(path.join(dir, `.claude/skills/${name}`)).endsWith(`.abmh/skills/${name}`))
    assert.ok(exists(dir, `.agents/skills/${name}/SKILL.md`))
  }
  assert.ok(!exists(dir, '.agents/skills/abms-spec-review'))
  const after = snapshot(dir)
  assert.match(abmh(dir, ['init']).out, /nothing to do/)
  assert.deepEqual(snapshot(dir), after)
})

test('remove takes the new skills away and leaves the tree as it was', () => {
  const dir = makeRepo({ 'README.md': 'mine\n' })
  const before = snapshot(dir)
  install(dir)
  assert.equal(removeAll(dir).code, 0)
  for (const name of NEW) assert.ok(!exists(dir, `.claude/skills/${name}`))
  assert.deepEqual(snapshot(dir).tree.filter((line) => !line.includes('.git/')), before.tree.filter((line) => !line.includes('.git/')))
})

test('an occupied path of a new skill is skipped and kept', () => {
  const dir = makeRepo({ '.claude/skills/grill/SKILL.md': 'my own grill' })
  assert.match(abmh(dir, ['init']).out, /skip .claude\/skills\/grill - path occupied/)
  install(dir)
  assert.equal(read(dir, '.claude/skills/grill/SKILL.md'), 'my own grill')
  assert.ok(exists(dir, '.claude/skills/wizard'))
})

test('an occupied shared-assistant link of a new skill is skipped and kept', () => {
  const dir = makeRepo({ '.agents/skills/wizard/SKILL.md': 'my own wizard' })
  assert.match(abmh(dir, ['init']).out, /skip .agents\/skills\/wizard - path occupied/)
  install(dir)
  assert.equal(read(dir, '.agents/skills/wizard/SKILL.md'), 'my own wizard')
  assert.ok(exists(dir, '.agents/skills/grill'))
})

test('invocation flags follow the SPEC table and wizard never runs its script', () => {
  const dir = makeRepo()
  install(dir)
  const head = (name) => read(dir, `.abmh/skills/${name}/SKILL.md`).split('---')[1]
  assert.match(head('grill'), /disable-model-invocation: true/)
  assert.match(head('wizard'), /disable-model-invocation: true/)
  assert.doesNotMatch(head('diagnose'), /disable-model-invocation/)
  assert.match(read(dir, '.abmh/skills/wizard/SKILL.md'), /never run/i)
  for (const name of NEW) assert.match(read(dir, `.abmh/skills/${name}/SKILL.md`), new RegExp(`name: ${name}\\n`))
})

test('each new skill file stays at 60 lines or fewer', () => {
  const dir = makeRepo()
  install(dir)
  for (const name of NEW) {
    const lines = read(dir, `.abmh/skills/${name}/SKILL.md`).split('\n').length
    assert.ok(lines <= 60, `${name} has ${lines} lines`)
  }
})

const FORBIDDEN = ['~/', ['000-ABM', 'S'].join(''), ['/User', 's/'].join(''), ['shared', 'domain'].join('-') + '/']

const filesUnder = (dir, rel) => {
  const base = path.join(dir, rel)
  return fs.readdirSync(base, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
}

for (const lang of ['en', 'es']) {
  test(`installed skills and protocols carry no absolute or ABMS-only path (${lang})`, () => {
    const dir = makeRepo()
    install(dir, ['--lang', lang])
    const files = [...filesUnder(dir, '.abmh/skills'), ...filesUnder(dir, '.abmh/core/protocols')]
    assert.ok(files.length >= 8)
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      for (const bad of FORBIDDEN) assert.ok(!text.includes(bad), `${path.relative(dir, file)} contains ${bad}`)
    }
  })
}

test('grill closes with glossary and decision records, per accepted item, and names its source', () => {
  const dir = makeRepo()
  install(dir)
  const protocol = read(dir, '.abmh/core/protocols/GRILL.md')
  assert.match(protocol, /GLOSSARY/)
  assert.match(protocol, /ADR-NNN/)
  assert.match(protocol, /never overwrit/i)
  assert.match(protocol, /only the items .* accept/i)
  assert.match(protocol, /next free number/)
  assert.match(protocol, /partial accept/)
  assert.match(protocol, /does not exist, create it only/)
  assert.match(read(dir, '.abmh/skills/grill/SKILL.md'), /grill-with-docs[^\n]*MIT/)
})

test('the Bug lane and the Diagnostician card name the diagnose skill and its protocol', () => {
  const dir = makeRepo()
  install(dir)
  for (const file of ['.abmh/lanes/bug.md', '.abmh/agents/diagnostician.md']) {
    const text = read(dir, file)
    assert.match(text, /`diagnose` skill/)
    assert.match(text, /protocols\/DIAGNOSE\.md/)
    assert.ok(text.split('\n').length <= 60)
  }
})

test('harness/skills holds exactly the five skills that travel', () => {
  const dirs = fs.readdirSync(new URL('../harness/skills', import.meta.url), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  assert.deepEqual(dirs, ['abms-spec-review', 'diagnose', 'grill', 'spec', 'wizard'])
})

for (const file of ['README.md', 'README.en.md']) {
  test(`${file}: the Skills section lists the core of eight, the rule and the packs`, () => {
    const text = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    const start = text.indexOf('\n## Skills')
    assert.ok(start > 0, 'no Skills section')
    const section = text.slice(start + 1).split('\n## ')[0]
    for (const name of ['spec', 'abms-spec-review', 'grill', 'wizard', 'diagnose', 'code-review', 'simplify', 'security-review']) {
      assert.ok(section.includes(`\`${name}\``), `${file} misses ${name}`)
    }
    for (const pack of ['impeccable', 'landing', 'accessibility-review', 'design-system', 'wrangler', 'workers-best-practices', 'web-perf', 'deploy-checklist']) {
      assert.ok(section.includes(pack), `${file} misses pack entry ${pack}`)
    }
    assert.match(section, /replaces another|sustituye a otra/)
  })
}
