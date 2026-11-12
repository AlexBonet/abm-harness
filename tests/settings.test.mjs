import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { formatSettings } from '../src/settings.mjs'
import { abmh, exists, install, makeRepo, manifestOf, read, removeAll, snapshot } from './helpers.mjs'

test('init writes harness.yaml with exactly version, profile, docsDir, packs and the pending stack', () => {
  const dir = makeRepo()
  assert.equal(install(dir).code, 0)
  const version = manifestOf(dir).harnessVersion
  assert.equal(read(dir, '.abmh/harness.yaml'), `version: ${version}\nprofile: universal\ndocsDir: 00-docs\npacks: code,comms,security,deploy\nstack: pending\n`)
})

test('harness.yaml is tracked in the manifest like any installed file', () => {
  const dir = makeRepo()
  install(dir)
  const entry = manifestOf(dir).entries.find((item) => item.path === '.abmh/harness.yaml')
  assert.equal(entry.kind, 'file')
  assert.match(entry.sha256, /^[0-9a-f]{64}$/)
})

test('remove deletes harness.yaml and restores the tree', () => {
  const dir = makeRepo({ 'keep.txt': 'x' })
  const before = snapshot(dir)
  install(dir)
  assert.equal(removeAll(dir).code, 0)
  assert.equal(exists(dir, '.abmh'), false)
  assert.deepEqual(snapshot(dir), before)
})

test('a hand-edited harness.yaml survives update', () => {
  const dir = makeRepo()
  install(dir)
  const edited = `${read(dir, '.abmh/harness.yaml')}# mine\n`
  fs.writeFileSync(`${dir}/.abmh/harness.yaml`, edited)
  const plan = abmh(dir, ['update'])
  assert.doesNotMatch(plan.out, /update-file \.abmh\/harness\.yaml/)
})

test('formatSettings writes exactly the keys it is given', () => {
  assert.equal(formatSettings({ version: 'abc', profile: 'universal', docsDir: 'x/y', packs: ['code'], pending: false }), 'version: abc\nprofile: universal\ndocsDir: x/y\npacks: code\n')
})
