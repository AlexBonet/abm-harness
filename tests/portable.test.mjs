import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { install, makeRepo, tempDir } from './helpers.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FORBIDDEN = [['000', 'ABMS'].join('-'), ['', 'Users', ''].join('/')]

function filesUnder(dir) {
  return fs.readdirSync(dir, { recursive: true }).map((rel) => path.join(dir, rel)).filter((file) => fs.statSync(file).isFile())
}

const offenders = (files) => files.filter((file) => FORBIDDEN.some((text) => fs.readFileSync(file, 'utf8').includes(text)))

test('harness/ carries no root name and no home path', () => {
  assert.deepEqual(offenders(filesUnder(path.join(ROOT, 'harness'))), [])
})

test('an installed project carries no root name and no home path', () => {
  const dir = makeRepo()
  install(dir)
  const files = [...filesUnder(path.join(dir, '.abmh')), path.join(dir, 'AGENTS.md')]
  assert.deepEqual(offenders(files), [])
})

test('verify.sh rule catches a planted forbidden string', () => {
  const copy = tempDir()
  for (const sub of ['bin', 'src', 'scripts', 'harness']) fs.cpSync(path.join(ROOT, sub), path.join(copy, sub), { recursive: true })
  fs.appendFileSync(path.join(copy, 'harness/VERSION'), `${FORBIDDEN[1]}x\n`)
  const result = spawnSync('grep', ['-rnE', '000-ABM[S]|/User[s]/', 'bin', 'src', 'scripts', 'tests', 'harness'], { cwd: copy, encoding: 'utf8' })
  assert.match(result.stdout, /harness\/VERSION/)
})
