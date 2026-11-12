import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { makeRepo, exists, snapshot } from './helpers.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readmeCommands(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('node ~/abm-harness/bin/abmh.mjs'))
    .map((line) => line.replace(/\s+#.*$/, '').replace('~/abm-harness', ROOT))
}

function sh(dir, command) {
  const [bin, ...args] = command.split(/\s+/)
  return spawnSync(bin, args, { cwd: dir, encoding: 'utf8' })
}

for (const file of ['README.md', 'README.en.md']) {
  test(`${file}: its commands run as written on a temp repo`, () => {
    const commands = readmeCommands(file)
    const bySubcommand = (name) => commands.find((command) => command.includes(` ${name}`) && !command.includes('--accept-plan'))
    const dir = makeRepo({ 'AGENTS.md': '# Mine\n' })
    const before = snapshot(dir)

    const plan = sh(dir, bySubcommand('init'))
    assert.equal(plan.status, 0, plan.stderr)
    assert.deepEqual(snapshot(dir), before)

    const acceptLine = plan.stdout.split('\n').find((line) => line.includes('--accept-plan')).trim().replace(/^node \S+/, `node ${ROOT}/bin/abmh.mjs`)
    assert.equal(sh(dir, acceptLine).status, 0)
    assert.ok(exists(dir, '.abmh/manifest.json'))

    assert.equal(sh(dir, bySubcommand('update')).status, 0)

    const removal = sh(dir, bySubcommand('remove'))
    assert.equal(removal.status, 0, removal.stderr)
    const removeAccept = removal.stdout.split('\n').find((line) => line.includes('--accept-plan')).trim().replace(/^node \S+/, `node ${ROOT}/bin/abmh.mjs`)
    assert.equal(sh(dir, removeAccept).status, 0)
    assert.deepEqual(snapshot(dir), before)
  })
}

test('both READMEs document every exit code and the same options', () => {
  for (const file of ['README.md', 'README.en.md']) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const option of ['--assistants', '--lang', '--profile', '--docs-dir', '--no-hooks', '--root', '--accept-plan', '--restore', '--backup-dir']) assert.ok(text.includes(option), `${file} misses ${option}`)
    assert.ok(/0 \S+ · 2 \S+/.test(text), `${file} misses exit codes`)
  }
})

test('the migrate command in both READMEs runs as written and writes nothing', () => {
  for (const file of ['README.md', 'README.en.md']) {
    const command = readmeCommands(file).find((line) => line.endsWith(' migrate'))
    assert.ok(command, `${file} has no migrate command`)
    const dir = makeRepo({ 'shared-domain/MEMORY.md': 'x shared-domain/ y\n' }, { git: false })
    const before = snapshot(dir)
    const result = sh(dir, command)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /rename shared-domain\/ -> 00-docs\//)
    assert.deepEqual(snapshot(dir), before)
  }
})
