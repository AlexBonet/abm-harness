import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex')

export function lstatOrNull(target) {
  try {
    return fs.lstatSync(target)
  } catch {
    return null
  }
}

export function fileSha(file) {
  const stat = lstatOrNull(file)
  return stat && stat.isFile() ? sha256(fs.readFileSync(file)) : null
}

export function atomicWrite(file, data, mode) {
  const temp = `${file}.abmh-tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
  try {
    fs.writeFileSync(temp, data, { flag: 'wx' })
    if (mode !== undefined) fs.chmodSync(temp, mode)
    fs.renameSync(temp, file)
  } finally {
    fs.rmSync(temp, { force: true })
  }
}

export function walkFiles(dir, base = dir) {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walkFiles(full, base))
    else if (entry.isFile()) found.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return found.sort()
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
  }
  return value
}

export const canonicalJson = (value) => JSON.stringify(sortKeys(value))

export const toPosix = (value) => value.split(path.sep).join('/')
