import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeRepo } from './helpers.mjs'

export const HARNESS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../harness')

export function project({ files = {}, stacks = [], git = true } = {}) {
  const dir = makeRepo(files, { git })
  const checks = path.join(dir, '.abmh/checks')
  fs.mkdirSync(path.join(dir, '.abmh'), { recursive: true })
  fs.cpSync(path.join(HARNESS, 'checks'), checks, { recursive: true })
  fs.cpSync(path.join(HARNESS, 'packs'), path.join(dir, '.abmh/packs'), { recursive: true })
  for (const name of fs.existsSync(path.join(checks, 'stack')) ? fs.readdirSync(path.join(checks, 'stack')) : []) {
    if (!stacks.includes(name.replace(/\.sh$/, ''))) fs.rmSync(path.join(checks, 'stack', name))
  }
  return dir
}

export function sh(dir, script, args = [], env = {}) {
  const result = spawnSync('sh', [path.join(dir, '.abmh/checks', script), ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } })
  return { code: result.status, out: `${result.stdout}${result.stderr}` }
}

export const write = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
  fs.writeFileSync(path.join(dir, rel), text)
}
