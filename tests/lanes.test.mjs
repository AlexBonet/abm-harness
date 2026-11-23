import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { abmh, exists, install, makeRepo, planId, read, removeAll } from './helpers.mjs'

const HARNESS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../harness')
const LANES = ['consult', 'change', 'short-spec', 'sdd', 'bug', 'deploy']
const LANE_HEADINGS = ['## Entry', '## Steps', '## Ends when', '## Gates', '## Escalates to SDD when']

const source = (rel) => fs.readFileSync(path.join(HARNESS, rel), 'utf8')
const lines = (text) => text.trimEnd().split('\n').length

test('there is one lane file per lane, each with the five headings and at most 60 lines', () => {
  assert.deepEqual(fs.readdirSync(path.join(HARNESS, 'lanes')).sort(), LANES.map((name) => `${name}.md`).sort())
  for (const name of LANES) {
    const text = source(`lanes/${name}.md`)
    for (const heading of LANE_HEADINGS) assert.ok(text.includes(heading), `${name}: ${heading}`)
    assert.ok(lines(text) <= 60, `${name} has ${lines(text)} lines`)
  }
})

test('the short SPEC template exists, stays under 8 KB and asks for the clean-context review', () => {
  const text = source('core/templates/SPEC-SHORT.template.md')
  assert.ok(Buffer.byteLength(text) <= 8192)
  assert.match(text, /clean-context/i)
  assert.match(text, /Given:/)
})

test('every lane opens with its own name so the Carril line is unambiguous', () => {
  for (const name of LANES) assert.match(source(`lanes/${name}.md`), /^# Lane: /)
})

const GATES = ['test', 'review', 'design', 'seo', 'security', 'release']
const GATE_HEADINGS = ['## Checks', '## Who', '## Applies when', '## Evidence']

test('there is one gate file per gate, each with the four headings and at most 60 lines', () => {
  assert.deepEqual(fs.readdirSync(path.join(HARNESS, 'gates')).sort(), GATES.map((name) => `${name}.md`).sort())
  for (const name of GATES) {
    const text = source(`gates/${name}.md`)
    for (const heading of GATE_HEADINGS) assert.ok(text.includes(heading), `${name}: ${heading}`)
    assert.ok(lines(text) <= 60, `${name} has ${lines(text)} lines`)
  }
})

test('every gate a lane points to exists', () => {
  for (const name of LANES) {
    const pointed = [...source(`lanes/${name}.md`).matchAll(/\{\{ABMH\}\}gates\/([a-z-]+)\.md/g)].map((match) => match[1])
    for (const gate of pointed) assert.ok(GATES.includes(gate), `${name} points to missing gate ${gate}`)
  }
})

const CARDS = ['router', 'scrum', 'architect', 'coder', 'reviewer', 'verifier', 'designer', 'release-operator', 'diagnostician', 'memory-keeper']
const CARD_HEADINGS = ['## Role', '## Sees', '## Can', '## Cannot', '## Tone', '## Worn when']

test('there is one card per agent, each with the six headings and at most 60 lines', () => {
  assert.deepEqual(
    fs.readdirSync(path.join(HARNESS, 'agents')).filter((name) => !name.startsWith('abms-')).sort(),
    CARDS.map((name) => `${name}.md`).sort(),
  )
  for (const name of CARDS) {
    const text = source(`agents/${name}.md`)
    for (const heading of CARD_HEADINGS) assert.ok(text.includes(heading), `${name}: ${heading}`)
    assert.ok(lines(text) <= 60, `${name} has ${lines(text)} lines`)
  }
})

test('only the Reviewer has its own clean session', () => {
  const own = CARDS.filter((name) => /own clean session/i.test(source(`agents/${name}.md`)))
  assert.deepEqual(own, ['reviewer'])
})

test('the Coder and Architect cards point to strict.md and strict.md exists', () => {
  assert.ok(fs.existsSync(path.join(HARNESS, 'strict.md')))
  for (const name of ['coder', 'architect']) assert.match(source(`agents/${name}.md`), /\{\{ABMH\}\}strict\.md/)
})

test('every card, lane and gate pointer resolves to an existing file', () => {
  const files = ['lanes', 'gates', 'agents'].flatMap((dir) => fs.readdirSync(path.join(HARNESS, dir)).filter((name) => !name.startsWith('abms-')).map((name) => `${dir}/${name}`))
  for (const rel of files) {
    for (const match of source(rel).matchAll(/\{\{ABMH\}\}([a-z/-]+\.md)/g)) assert.ok(fs.existsSync(path.join(HARNESS, match[1])), `${rel} points to ${match[1]}`)
  }
})

const installed = (dir, sub) => fs.readdirSync(path.join(dir, '.abmh', sub)).filter((name) => !name.startsWith('abms-')).sort()

for (const profile of ['universal', 'abm-estricto']) {
  test(`init installs lanes, gates and cards with the ${profile} profile`, () => {
    const dir = makeRepo()
    assert.equal(install(dir, ['--profile', profile]).code, 0)
    assert.equal(installed(dir, 'lanes').length, 6)
    assert.equal(installed(dir, 'gates').length, 6)
    assert.equal(installed(dir, 'agents').length, 10)
    assert.equal(exists(dir, '.abmh/core/templates/SPEC-SHORT.template.md'), true)
    assert.equal(exists(dir, '.abmh/strict.md'), profile === 'abm-estricto')
    const linked = fs.readdirSync(path.join(dir, '.claude/agents')).sort()
    assert.deepEqual(linked, fs.readdirSync(path.join(dir, '.abmh/agents')).filter((name) => name.startsWith('abms-')).sort())
    const files = ['lanes', 'gates', 'agents'].flatMap((sub) => installed(dir, sub).map((name) => `.abmh/${sub}/${name}`))
    for (const rel of files) {
      const text = read(dir, rel)
      assert.doesNotMatch(text, /\{\{|_system\//, rel)
      for (const match of [...text.matchAll(/\.abmh\/([A-Za-z0-9_./-]+\.md)/g)].filter((found) => found[1] !== 'strict.md')) assert.equal(exists(dir, `.abmh/${match[1]}`), true, `${rel} points to ${match[1]}`)
    }
  })
}

test('every lane that leaves a change passes the Revisión gate; Consulta writes nothing and does not', () => {
  for (const name of LANES.filter((lane) => lane !== 'consult')) assert.match(source(`lanes/${name}.md`), /\{\{ABMH\}\}gates\/review\.md/, name)
  assert.doesNotMatch(source('lanes/consult.md'), /gates\/review\.md/)
  assert.doesNotMatch(source('lanes/bug.md'), /payments/)
})

test('the Revisión gate states who launches it, the reviewer choice, the size rule and the two-round limit', () => {
  const text = source('gates/review.md')
  for (const needle of [/launched by the Coder/i, /`reviewer:`/, /opposite/, /Haiku/, /Sonnet/, /second REJECTED/i, /docs/i]) assert.match(text, needle)
})

test('the baseline no longer lets a docs-only change skip the Reviewer', () => {
  assert.doesNotMatch(source('core/AGENT_BASELINE.md'), /Verify Gate only/)
})

test('update keeps an edited lane and remove deletes only the unedited harness files', () => {
  const dir = makeRepo()
  install(dir)
  fs.appendFileSync(path.join(dir, '.abmh/lanes/bug.md'), '\nmine\n')
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /skip .abmh\/lanes\/bug.md - edited by hand/)
  assert.equal(abmh(dir, ['update', '--accept-plan', planId(plan.out)]).code, 0)
  assert.match(read(dir, '.abmh/lanes/bug.md'), /mine/)
  assert.equal(removeAll(dir).code, 0)
  assert.equal(exists(dir, '.abmh/lanes/bug.md'), true)
  assert.equal(exists(dir, '.abmh/lanes/sdd.md'), false)
  assert.equal(exists(dir, '.abmh/gates/test.md'), false)
})
