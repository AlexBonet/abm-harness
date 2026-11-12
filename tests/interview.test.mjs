import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { interview, needsInterview } from '../src/interview.mjs'
import { abmh, makeRepo } from './helpers.mjs'

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '../bin/abmh.mjs')
const TTY = { stdinTTY: true, stdoutTTY: true }

const scripted = (answers) => {
  const asked = []
  const ask = async (question) => {
    asked.push(question)
    return answers.shift() ?? ''
  }
  return { ask, asked }
}

test('the interview runs only for init on a terminal without --accept-plan or --yes', () => {
  assert.equal(needsInterview(['init'], TTY), true)
  assert.equal(needsInterview(['init'], { stdinTTY: false, stdoutTTY: true }), false)
  assert.equal(needsInterview(['init'], { stdinTTY: true, stdoutTTY: false }), false)
  assert.equal(needsInterview(['init', '--accept-plan', 'abc'], TTY), false)
  assert.equal(needsInterview(['init', '--yes'], TTY), false)
  for (const command of ['update', 'remove', 'doctor', 'migrate']) assert.equal(needsInterview([command], TTY), false)
})

test('answers become flags and the defaults add none', async () => {
  const dir = makeRepo({})
  const none = scripted(['', '', '', ''])
  assert.deepEqual(await interview(['init', '--root', dir], none.ask), [])
  const chosen = scripted(['2', 'claude,codex', 's', 'y'])
  assert.deepEqual(await interview(['init', '--root', dir], chosen.ask), ['--profile', 'abm-estricto', '--assistants', 'claude,codex', '--packs', 'seo', '--ci'])
})

test('a choice already given as a flag is not asked again', async () => {
  const dir = makeRepo({})
  const { ask, asked } = scripted([''])
  const flags = await interview(['init', '--root', dir, '--profile', 'universal', '--assistants=claude', '--packs', 'data'], ask)
  assert.deepEqual(flags, [])
  assert.equal(asked.length, 1)
})

test('the docs folder is asked only when 00-docs already exists', async () => {
  const empty = makeRepo({})
  const plain = scripted(['', '', '', ''])
  await interview(['init', '--root', empty], plain.ask)
  assert.equal(plain.asked.length, 4)
  const busy = makeRepo({ '00-docs/mine.md': 'x\n' })
  const { ask, asked } = scripted(['', '', '', '', 'harness-docs'])
  const flags = await interview(['init', '--root', busy], ask)
  assert.equal(asked.length, 5)
  assert.deepEqual(flags, ['--docs-dir', 'harness-docs'])
})

test('an unknown assistant is asked again and three bad answers fall back to all', async () => {
  const dir = makeRepo({})
  const { ask } = scripted(['', 'nope', 'claude', '', ''])
  assert.deepEqual(await interview(['init', '--root', dir], ask), ['--assistants', 'claude'])
  const bad = scripted(['', 'x', 'y', 'z', '', ''])
  assert.deepEqual(await interview(['init', '--root', dir], bad.ask), [])
})

test('the questions follow --lang', async () => {
  const dir = makeRepo({})
  const en = scripted(['', '', '', ''])
  await interview(['init', '--root', dir, '--lang', 'en'], en.ask)
  assert.match(en.asked[0], /profile/i)
  const es = scripted(['', '', '', ''])
  await interview(['init', '--root', dir], es.ask)
  assert.match(es.asked[0], /perfil/i)
})

test('the flags an interview produces give the plan that is shown before anything is written', async () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  const flags = await interview(['init', '--root', dir], scripted(['', '', '', 'si']).ask)
  const result = abmh(dir, ['init', ...flags])
  assert.equal(result.code, 0)
  assert.match(result.out, /create-file \.github\/workflows/)
  assert.doesNotMatch(result.out, /add --ci/)
  assert.equal(fs.existsSync(path.join(dir, '.abmh')), false)
})

test('without a terminal the command never prompts and keeps today\'s behaviour', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  const result = spawnSync('node', [BIN, 'init'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /plan id: [0-9a-f]{64}/)
  assert.equal(fs.existsSync(path.join(dir, '.abmh')), false)
})

test('--yes is an init flag and nothing else', () => {
  const dir = makeRepo({})
  assert.equal(abmh(dir, ['init', '--yes']).code, 0)
  assert.equal(abmh(dir, ['update', '--yes']).code, 2)
})
