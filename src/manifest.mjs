import fs from 'node:fs'
import path from 'node:path'
import { refused } from './errors.mjs'
import { atomicWrite, lstatOrNull } from './fsutil.mjs'

export const MANIFEST = '.abmh/manifest.json'

export function readManifest(root) {
  const file = path.join(root, MANIFEST)
  if (!lstatOrNull(file)) return null
  try {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (manifest.schema !== 1 || !Array.isArray(manifest.entries)) throw new Error('shape')
    return manifest
  } catch {
    throw refused('.abmh/manifest.json is unreadable; nothing was touched')
  }
}

export const saveManifest = (root, manifest) =>
  atomicWrite(path.join(root, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)

const sameEntry = (a, b) => a.kind === b.kind && a.path === b.path && a.key === b.key

export function upsertEntry(manifest, entry) {
  const index = manifest.entries.findIndex((existing) => sameEntry(existing, entry))
  if (index >= 0) manifest.entries[index] = entry
  else manifest.entries.push(entry)
}

export const findEntry = (manifest, kind, entryPath) =>
  manifest.entries.find((entry) => entry.kind === kind && entry.path === entryPath)

export function removeEntry(manifest, kind, entryPath) {
  manifest.entries = manifest.entries.filter((entry) => !(entry.kind === kind && entry.path === entryPath))
}
