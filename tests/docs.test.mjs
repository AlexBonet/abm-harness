import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, exists, install, makeRepo, planId, read, removeAll, snapshot } from './helpers.mjs'

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex')

test('init creates 00-docs/decisions with a guide and a template, in the chosen language', () => {
  const spanish = makeRepo()
  install(spanish)
  assert.match(read(spanish, '00-docs/decisions/README.md'), /^# Decisiones/)
  assert.match(read(spanish, '00-docs/decisions/TEMPLATE.md'), /ADR-NNN — Título corto/)
  const english = makeRepo()
  install(english, ['--lang', 'en'])
  assert.match(read(english, '00-docs/decisions/README.md'), /^# Decisions/)
  assert.match(read(english, '00-docs/decisions/TEMPLATE.md'), /Short title/)
})

test('the plan lists the docs group and the block mentions the folder', () => {
  const dir = makeRepo()
  const plan = abmh(dir, ['init'])
  assert.match(plan.out, /\[docs\]\n(?:.*\n)* {2}create-file 00-docs\/decisions\/ \(2 files\) - a place to record decisions/)
  install(dir)
  assert.match(read(dir, 'AGENTS.md'), /Record decisions in `00-docs\/decisions\/`/)
})

test('decisions the human wrote survive remove; untouched guide files and empty folders go', () => {
  const dir = makeRepo()
  const before = snapshot(dir)
  install(dir)
  fs.writeFileSync(path.join(dir, '00-docs/decisions/ADR-001-use-postgres.md'), '# ADR-001\n')
  fs.appendFileSync(path.join(dir, '00-docs/decisions/README.md'), '\nmy note\n')
  removeAll(dir)
  assert.ok(exists(dir, '00-docs/decisions/ADR-001-use-postgres.md'))
  assert.ok(read(dir, '00-docs/decisions/README.md').includes('my note'))
  assert.ok(!exists(dir, '00-docs/decisions/TEMPLATE.md'))
  fs.rmSync(path.join(dir, '00-docs'), { recursive: true })
  assert.deepEqual(snapshot(dir), before)
})

test('remove leaves no docs folder when nothing was added', () => {
  const dir = makeRepo()
  const before = snapshot(dir)
  install(dir)
  removeAll(dir)
  assert.deepEqual(snapshot(dir), before)
})

test('update adds the docs folder and the new block line to an older install', () => {
  const dir = makeRepo()
  install(dir)
  fs.rmSync(path.join(dir, '00-docs'), { recursive: true })
  const manifest = JSON.parse(read(dir, '.abmh/manifest.json'))
  manifest.entries = manifest.entries.filter((entry) => !entry.path.startsWith('00-docs'))
  const stale = read(dir, 'AGENTS.md').replace(/Record decisions[^\n]*\n/, '')
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), stale)
  const block = manifest.entries.find((entry) => entry.path === 'AGENTS.md')
  block.sha256 = sha(stale.slice(stale.indexOf('<!-- abmh:start -->'), stale.indexOf('<!-- abmh:end -->') + 17))
  fs.writeFileSync(path.join(dir, '.abmh/manifest.json'), JSON.stringify(manifest))
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /create-file 00-docs\/decisions\/ \(2 files\) - a place to record decisions/)
  assert.match(plan.out, /update-block AGENTS.md/)
  assert.equal(abmh(dir, ['update', '--accept-plan', planId(plan.out)]).code, 0)
  assert.ok(exists(dir, '00-docs/decisions/README.md'))
  assert.match(read(dir, 'AGENTS.md'), /Record decisions/)
})


const STARTERS = ['LEEME', 'STATUS', 'MEMORY', 'GAPS']

test('init creates the four starter files in 00-docs, each with Audience and a summary, in both languages', () => {
  for (const [lang, summary] of [['es', /\*\*Resumen:\*\*/], ['en', /\*\*Summary:\*\*/]]) {
    const dir = makeRepo()
    install(dir, ['--lang', lang])
    for (const name of STARTERS) {
      const text = read(dir, `00-docs/${name}.md`)
      assert.match(text, /^Audience: (person|agent|both)$/m, name)
      assert.match(text, summary, name)
    }
  }
})

test('starter files are the same in both profiles', () => {
  for (const profile of ['universal', 'abm-estricto']) {
    const dir = makeRepo()
    install(dir, ['--profile', profile])
    for (const name of STARTERS) assert.ok(exists(dir, `00-docs/${name}.md`), `${profile} ${name}`)
  }
})

test('update keeps an edited starter file and remove deletes only the untouched ones', () => {
  const dir = makeRepo()
  const before = snapshot(dir)
  install(dir)
  fs.appendFileSync(path.join(dir, '00-docs/MEMORY.md'), '\nmy memory\n')
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /skip 00-docs\/MEMORY.md - edited by hand, kept/)
  assert.doesNotMatch(plan.out, /update-file/)
  removeAll(dir)
  assert.ok(read(dir, '00-docs/MEMORY.md').includes('my memory'))
  for (const name of ['LEEME', 'STATUS', 'GAPS']) assert.equal(exists(dir, `00-docs/${name}.md`), false, name)
  fs.rmSync(path.join(dir, '00-docs'), { recursive: true })
  assert.deepEqual(snapshot(dir), before)
})

test('a starter file the human already has is skipped and listed, never overwritten', () => {
  const dir = makeRepo({ '00-docs/STATUS.md': '# my status\n' })
  const plan = abmh(dir, ['init'])
  assert.match(plan.out, /skip 00-docs\/STATUS.md - exists, not installed by abm-harness/)
  assert.equal(abmh(dir, ['init', '--accept-plan', planId(plan.out)]).code, 0)
  assert.equal(read(dir, '00-docs/STATUS.md'), '# my status\n')
})
