import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { applyFailed, refused } from './errors.mjs'
import { OLD_DIR } from './docsscan.mjs'

const TAR_SUFFIX = '.tar.gz'

export const sidecarOf = (tar) => `${tar.slice(0, -TAR_SUFFIX.length)}.json`

export const stampOf = (date) => date.toISOString().replace(/[-:]/g, '').slice(0, 15)

export const backupBase = (root, date) => `${path.basename(root)}-${stampOf(date)}`

const tar = (args) => execFileSync('tar', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 })

const normalize = (entry) => entry.replace(/^\.\//, '').replace(/\/$/, '').normalize('NFC')

export function createBackup({ root, dir, base, outside }) {
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${base}${TAR_SUFFIX}`)
  if (fs.existsSync(file)) throw applyFailed(`${file} already exists; nothing was touched`)
  const paths = [OLD_DIR, ...outside]
  try {
    tar(['-czf', file, '-C', root, ...paths.map((item) => `./${item}`)])
    const listed = new Set(tar(['-tzf', file]).split('\n').filter(Boolean).map(normalize))
    const missing = paths.filter((item) => !listed.has(item.normalize('NFC')))
    if (missing.length > 0) throw new Error(`the copy misses ${missing.join(', ')}`)
  } catch (error) {
    fs.rmSync(file, { force: true })
    throw applyFailed(`the backup could not be written (${error.message.split('\n')[0]}); nothing was touched`)
  }
  return file
}

export function writeSidecar(file, data) {
  fs.writeFileSync(sidecarOf(file), `${JSON.stringify(data, null, 2)}\n`)
}

export function readSidecar(file) {
  if (!file.endsWith(TAR_SUFFIX) || !fs.existsSync(file)) throw refused(`${file} is not a backup made by abmh migrate`)
  const side = sidecarOf(file)
  if (!fs.existsSync(side)) throw refused(`${side} is missing; the backup cannot be restored safely`)
  const data = JSON.parse(fs.readFileSync(side, 'utf8'))
  if (typeof data.root !== 'string' || !Array.isArray(data.edited) || typeof data.createdAt !== 'string') {
    throw refused(`${side} is not a valid backup record`)
  }
  return data
}

export const extractBackup = (file, root) => tar(['-xzf', file, '-C', root])
