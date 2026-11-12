import fs from 'node:fs'
import path from 'node:path'
import { usageError } from './errors.mjs'
import { HARNESS_DIR } from './harness.mjs'

export const PACKS_FILE = 'packs.json'

const catalog = () => JSON.parse(fs.readFileSync(path.join(HARNESS_DIR, PACKS_FILE), 'utf8')).packs

const idsOfKinds = (kinds) =>
  Object.entries(catalog()).filter(([, pack]) => kinds.includes(pack.kind)).map(([id]) => id)

export const stackPackIds = () => idsOfKinds(['stack'])

export const selectablePackIds = () => idsOfKinds(['stack', 'detect', 'optional'])

const ownerOf = (rel) => Object.entries(catalog()).find(([, pack]) => pack.files.includes(rel))?.[0] ?? null

export const inPacks = (rel, ids) => {
  const owner = ownerOf(rel)
  return owner === null || ids.includes(owner)
}

export function parsePacks(value) {
  if (value === undefined) return []
  const requested = value.split(',').map((name) => name.trim()).filter(Boolean)
  const valid = selectablePackIds()
  const unknown = requested.filter((name) => !valid.includes(name))
  if (unknown.length > 0 || requested.length === 0) {
    throw usageError(`unknown pack ${unknown.join(', ') || value}. Valid: ${valid.join(', ')}`)
  }
  return requested
}

export function selectPacks({ profile, detected, requested, stored }) {
  const entries = Object.entries(catalog())
  const chosen = new Map()
  for (const [id, pack] of entries) {
    if (pack.kind === 'always') chosen.set(id, 'always')
    if (pack.kind === 'profile' && pack.profile === profile) chosen.set(id, `profile ${profile}`)
  }
  for (const id of stored ?? []) if (!chosen.has(id) && entries.some(([known]) => known === id)) chosen.set(id, 'installed')
  if (stored === null) for (const { pack, reason } of detected) chosen.set(pack, reason)
  for (const id of requested) chosen.set(id, 'asked with --packs')
  const ids = entries.map(([id]) => id).filter((id) => chosen.has(id))
  const pending = !ids.some((id) => stackPackIds().includes(id))
  return { ids, reasons: ids.map((id) => ({ id, reason: chosen.get(id) })), pending }
}

export const packNotes = (selection, alreadyInstalled) => {
  const notes = selection.reasons
    .filter(({ id }) => !alreadyInstalled.includes(id))
    .map(({ id, reason }) => ({ op: 'note', group: 'packs', path: id, reason }))
  if (selection.pending && notes.length > 0) {
    notes.push({ op: 'note', group: 'packs', path: 'stack', reason: `no stack detected; finish later with abmh update --packs <id> (${stackPackIds().join(', ')})` })
  }
  return notes
}
