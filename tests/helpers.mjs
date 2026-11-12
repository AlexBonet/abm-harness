import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { run } from '../src/cli.mjs'

export function tempDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-')))
}

export function makeRepo(files = {}, { git = true } = {}) {
  const dir = tempDir()
  if (git) execFileSync('git', ['init', '-q', dir])
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    fs.writeFileSync(path.join(dir, name), content)
  }
  return dir
}

export function abmh(dir, argv, inject = {}) {
  const out = []
  const err = []
  const code = run(argv, { cwd: dir, out: (line) => out.push(line), err: (line) => err.push(line), inject })
  return { code, out: out.join('\n'), err: err.join('\n') }
}

export const planId = (output) => output.match(/plan id: ([0-9a-f]{64})/)[1]

export function install(dir, extra = [], inject = {}) {
  const plan = abmh(dir, ['init', ...extra])
  return abmh(dir, ['init', ...extra, '--accept-plan', planId(plan.out)], inject)
}

export function removeAll(dir) {
  const plan = abmh(dir, ['remove'])
  return abmh(dir, ['remove', '--accept-plan', planId(plan.out)])
}

function walk(dir, base, found) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' && dir === base) continue
    const full = path.join(dir, entry.name)
    const rel = path.relative(base, full)
    if (entry.isSymbolicLink()) found.push(`link ${rel} -> ${fs.readlinkSync(full)}`)
    else if (entry.isDirectory()) {
      found.push(`dir ${rel}`)
      walk(full, base, found)
    } else found.push(`file ${rel} ${crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')}`)
  }
  return found
}

export function snapshot(dir) {
  const isRepo = fs.existsSync(path.join(dir, '.git'))
  const config = isRepo ? execFileSync('git', ['-C', dir, 'config', '--local', '-l'], { encoding: 'utf8' }) : ''
  return { tree: walk(dir, dir, []).sort(), config }
}

export const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8')

export const exists = (dir, rel) => fs.existsSync(path.join(dir, rel))

export const manifestOf = (dir) => JSON.parse(read(dir, '.abmh/manifest.json'))
