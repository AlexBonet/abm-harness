import fs from 'node:fs'
import path from 'node:path'
import { lstatOrNull, walkFiles } from './fsutil.mjs'

const INSIDE_ABMH = (value) => value === '.abmh' || value.startsWith('.abmh/')

const ancestors = (value) => {
  const parts = value.split('/')
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'))
}

function isWanted(dir, state) {
  const files = state.files.map((file) => file.path)
  const links = state.links.map((spec) => spec.path)
  const blocks = state.blocks.map((block) => block.path)
  const parents = new Set([...files, ...links, ...blocks].flatMap(ancestors))
  return parents.has(dir) || links.some((link) => dir.startsWith(`${link}/`))
}

function remainingFiles(root, dir, deleted) {
  const abs = path.join(root, dir)
  if (!lstatOrNull(abs)?.isDirectory()) return []
  return walkFiles(abs).map((rel) => `${dir}/${rel}`).filter((file) => !deleted.has(file))
}

export function retireActions(root, manifest, state, fileOps) {
  const deleted = new Set(fileOps.filter((op) => op.op === 'delete-file').map((op) => op.path))
  const retired = manifest.entries
    .filter((entry) => entry.kind === 'dir' && entry.createdByInstaller && !INSIDE_ABMH(entry.path) && !isWanted(entry.path, state))
    .map((entry) => entry.path)
    .sort((a, b) => b.length - a.length)
  const actions = []
  for (const dir of retired) {
    const stays = remainingFiles(root, dir, deleted)
    actions.push({ op: 'retire-dir', group: 'migration', path: dir, reason: stays.length === 0 ? 'no longer used, removed if empty' : 'no longer used, left in place and no longer tracked' })
    for (const file of stays) {
      if (!actions.some((action) => action.path === file)) actions.push({ op: 'skip', group: 'migration', path: file, reason: 'stays where it is, not moved' })
    }
  }
  return actions
}

export function retireDir(root, dir) {
  const abs = path.join(root, dir)
  if (lstatOrNull(abs)?.isDirectory() && fs.readdirSync(abs).length === 0) fs.rmdirSync(abs)
}
