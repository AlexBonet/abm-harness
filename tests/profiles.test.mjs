import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, exists, install, makeRepo, manifestOf, read, removeAll, snapshot } from './helpers.mjs'

const STRICT_ONLY = ['AGENT_CODER.template.md', 'STATUS.template.md', 'MEMORY.template.md', 'init-template.sh.md']
const UNIVERSAL = ['SPEC.template.md', 'DESIGN.template.md', 'PROPOSAL.template.md', 'ADR.template.md', 'verify-template.sh.md']

const installedFiles = (dir) =>
  fs.readdirSync(path.join(dir, '.abmh'), { recursive: true }).filter((rel) => fs.statSync(path.join(dir, '.abmh', rel)).isFile())

test('init without --profile installs universal and records it', () => {
  const dir = makeRepo()
  assert.equal(install(dir).code, 0)
  assert.equal(manifestOf(dir).options.profile, 'universal')
  assert.match(read(dir, '.abmh/harness.yaml'), /profile: universal/)
  for (const name of STRICT_ONLY) assert.equal(exists(dir, `.abmh/core/templates/${name}`), false, name)
  for (const name of UNIVERSAL) assert.equal(exists(dir, `.abmh/core/templates/${name}`), true, name)
  assert.equal(exists(dir, '.abmh/profiles.json'), false)
})

test('--profile abm-estricto adds the project templates', () => {
  const dir = makeRepo()
  assert.equal(install(dir, ['--profile', 'abm-estricto']).code, 0)
  assert.match(read(dir, '.abmh/harness.yaml'), /profile: abm-estricto/)
  for (const name of [...STRICT_ONLY, ...UNIVERSAL]) assert.equal(exists(dir, `.abmh/core/templates/${name}`), true, name)
})

test('the plan shows the profile in its accept command and an unknown profile is refused', () => {
  const dir = makeRepo()
  assert.match(abmh(dir, ['init', '--profile', 'abm-estricto']).out, /--profile abm-estricto/)
  const bad = abmh(dir, ['init', '--profile', 'nope'])
  assert.equal(bad.code, 2)
  assert.match(bad.err, /invalid --profile/)
  assert.equal(abmh(dir, ['update', '--profile', 'abm-estricto']).code, 2)
})

test('profiles install and remove cleanly', () => {
  const dir = makeRepo({ 'keep.txt': 'x' })
  const before = snapshot(dir)
  install(dir, ['--profile', 'abm-estricto'])
  assert.equal(removeAll(dir).code, 0)
  assert.deepEqual(snapshot(dir), before)
})

test('every core path mentioned by a universal file exists in the universal install', () => {
  const dir = makeRepo()
  install(dir)
  const present = new Set(installedFiles(dir).map((rel) => `.abmh/${rel}`))
  const missing = []
  for (const rel of installedFiles(dir).filter((name) => name.endsWith('.md') || name.endsWith('.sh'))) {
    for (const match of read(dir, `.abmh/${rel}`).matchAll(/\.abmh\/core\/[A-Za-z0-9_./-]*[A-Za-z0-9_]\.(?:md|sh)\b/g)) {
      if (!present.has(match[0])) missing.push(`${rel} -> ${match[0]}`)
    }
  }
  assert.deepEqual(missing, [])
})
