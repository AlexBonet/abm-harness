import fs from 'node:fs'
import path from 'node:path'
import { extractBlock, inspectBlock, removeBlock } from './block.mjs'
import { guardRemoval, removeGuard } from './claudehooks.mjs'
import { applyFailed } from './errors.mjs'
import { atomicWrite, fileSha, lstatOrNull, sha256 } from './fsutil.mjs'
import { readConfig, setLocalConfig, unsetLocalConfig } from './git.mjs'
import { acquireLock } from './lock.mjs'
import { MANIFEST } from './manifest.mjs'
import { assertEditable } from './paths.mjs'
import { makePlan } from './plan.mjs'

const keep = (entry, reason) => ({ op: 'skip', group: 'remove', path: entry.path, reason })

function linkRemoval(root, entry) {
  const abs = path.join(root, entry.path)
  const stat = lstatOrNull(abs)
  if (!stat) return null
  const expected = path.join(root, entry.target)
  const points = stat.isSymbolicLink() && path.resolve(path.dirname(abs), fs.readlinkSync(abs)) === expected
  return points ? { op: 'unlink', group: 'remove', path: entry.path, reason: 'harness link' } : keep(entry, 'no longer our link, kept')
}

function fileRemoval(root, entry) {
  const disk = fileSha(path.join(root, entry.path))
  if (disk === null) return null
  if (disk !== entry.sha256) return keep(entry, 'edited by hand, kept')
  return { op: 'delete-file', group: 'remove', path: entry.path, diskSha: disk, reason: 'harness file' }
}

function blockRemoval(root, entry) {
  const file = assertEditable(root, path.join(root, entry.path))
  if (lstatOrNull(file) === null) return null
  const text = fs.readFileSync(file, 'utf8')
  if (inspectBlock(text).state !== 'present' || sha256(extractBlock(text)) !== entry.sha256) {
    return keep(entry, 'block edited or missing, kept')
  }
  return {
    op: 'remove-block',
    group: 'remove',
    path: entry.path,
    diskSha: sha256(text),
    prefix: entry.prefix,
    eol: entry.eol,
    createdFile: entry.createdFile,
    reason: 'harness block',
  }
}

function configRemoval(root, entry) {
  if (readConfig(root, entry.key, true) !== entry.value) return keep(entry, 'value changed since install, kept')
  return { op: 'restore-config', group: 'remove', path: entry.path, key: entry.key, previous: entry.previous, reason: 'restore git config' }
}

const REMOVERS = {
  link: linkRemoval,
  file: fileRemoval,
  block: blockRemoval,
  gitconfig: configRemoval,
  claudehooks: guardRemoval,
  dir: (root, entry) => (entry.path === '.abmh' || !entry.createdByInstaller ? null : { op: 'remove-dir', group: 'remove', path: entry.path, reason: 'created by the installer, removed if empty' }),
}

export function removePlan(ctx) {
  const { root, manifest } = ctx
  const actions = [...manifest.entries].reverse().map((entry) => REMOVERS[entry.kind](root, entry)).filter(Boolean)
  return makePlan('remove', { ...ctx, options: manifest.options, harnessVersion: manifest.harnessVersion }, actions)
}

function removeFromBlock(root, action) {
  const file = assertEditable(root, path.join(root, action.path))
  const text = fs.readFileSync(file, 'utf8')
  if (sha256(text) !== action.diskSha) throw applyFailed(`${action.path} changed since the plan was printed`)
  const next = removeBlock(text, action.prefix ?? '', action.eol ?? '\n')
  if (next === '' && action.createdFile) fs.rmSync(file)
  else atomicWrite(file, next, fs.statSync(file).mode & 0o777)
}

function restoreConfig(root, action) {
  if (action.previous === null || action.previous === undefined) unsetLocalConfig(root, action.key)
  else setLocalConfig(root, action.key, action.previous)
}

function removeDirIfEmpty(root, action) {
  const abs = path.join(root, action.path)
  if (lstatOrNull(abs)?.isDirectory() && fs.readdirSync(abs).length === 0) fs.rmdirSync(abs)
}

const EXECUTORS = {
  unlink: (root, action) => fs.rmSync(path.join(root, action.path)),
  'delete-file': (root, action) => {
    const abs = path.join(root, action.path)
    if (fileSha(abs) !== action.diskSha) throw applyFailed(`${action.path} changed since the plan was printed`)
    fs.rmSync(abs)
  },
  'remove-block': removeFromBlock,
  'restore-config': restoreConfig,
  'remove-claude-hooks': removeGuard,
  'remove-dir': removeDirIfEmpty,
  skip: () => {},
}

export function applyRemove(ctx, plan, inject = {}) {
  const { root, manifest } = ctx
  const release = acquireLock(root)
  try {
    plan.actions.forEach((action, index) => {
      inject.beforeAction?.(index)
      EXECUTORS[action.op](root, action)
    })
  } finally {
    release()
  }
  fs.rmSync(path.join(root, MANIFEST), { force: true })
  const abmh = path.join(root, '.abmh')
  const owned = manifest.entries.find((entry) => entry.kind === 'dir' && entry.path === '.abmh')?.createdByInstaller
  if (owned && fs.existsSync(abmh) && fs.readdirSync(abmh).length === 0) fs.rmdirSync(abmh)
}
