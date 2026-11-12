import fs from 'node:fs'
import path from 'node:path'
import { buildBlock, detectEol, insertBlock, inspectBlock, replaceBlock, toEol, extractBlock } from './block.mjs'
import { applyFailed } from './errors.mjs'
import { atomicWrite, fileSha, lstatOrNull, sha256, toPosix, walkFiles } from './fsutil.mjs'
import { readConfig, setLocalConfig } from './git.mjs'
import { renderHarnessFile } from './harness.mjs'
import { acquireLock } from './lock.mjs'
import { retireDir } from './migrate.mjs'
import { findEntry, removeEntry, saveManifest, upsertEntry } from './manifest.mjs'
import { assertEditable, assertInside } from './paths.mjs'
import { DEFAULT_DOCS_DIR } from './settings.mjs'

const rel = (state, abs) => toPosix(path.relative(state.root, abs))

function ensureDirs(state, dirAbs) {
  const missing = []
  let current = dirAbs
  while (!fs.existsSync(current)) {
    missing.unshift(current)
    current = path.dirname(current)
  }
  for (const dir of missing) {
    assertInside(state.root, dir)
    fs.mkdirSync(dir)
    upsertEntry(state.manifest, { kind: 'dir', path: rel(state, dir), createdByInstaller: true })
  }
}

function writeHarnessFile(state, action) {
  const content = action.content === undefined ? renderHarnessFile(action.source, state.manifest.options.lang) : Buffer.from(action.content)
  if (sha256(content) !== action.sha256) throw applyFailed('the harness changed since the plan was printed')
  const abs = path.join(state.root, action.path)
  assertInside(state.root, abs)
  const current = fileSha(abs)
  if (action.op === 'create-file' && current !== null && current !== action.sha256) {
    throw applyFailed(`${action.path} already exists`)
  }
  if (action.op === 'update-file' && current !== action.diskSha && current !== action.sha256) {
    throw applyFailed(`${action.path} changed since the plan was printed`)
  }
  ensureDirs(state, path.dirname(abs))
  if (current !== action.sha256) atomicWrite(abs, content, action.mode)
  upsertEntry(state.manifest, { kind: 'file', path: action.path, sha256: action.sha256, mode: action.mode, createdByInstaller: true })
}

function deleteHarnessFile(state, action) {
  const abs = path.join(state.root, action.path)
  const current = fileSha(abs)
  if (current !== null && current !== action.diskSha) throw applyFailed(`${action.path} changed since the plan was printed`)
  if (current !== null) fs.rmSync(abs)
  removeEntry(state.manifest, 'file', action.path)
}

function copyTree(state, source, destination) {
  const stat = fs.statSync(source)
  const files = stat.isDirectory() ? walkFiles(source).map((file) => [path.join(source, file), path.join(destination, file)]) : [[source, destination]]
  ensureDirs(state, path.dirname(destination))
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true })
    upsertEntry(state.manifest, { kind: 'dir', path: rel(state, destination), createdByInstaller: true })
  }
  for (const [from, to] of files) {
    ensureDirs(state, path.dirname(to))
    const content = fs.readFileSync(from)
    atomicWrite(to, content, stat.isDirectory() ? undefined : stat.mode & 0o777)
    upsertEntry(state.manifest, { kind: 'file', path: rel(state, to), sha256: sha256(content), createdByInstaller: true, copyOf: rel(state, from) })
  }
}

function applyLink(state, action) {
  const abs = path.join(state.root, action.path)
  const targetAbs = path.join(state.root, action.target)
  assertInside(state.root, abs)
  const existing = lstatOrNull(abs)
  const relative = path.relative(path.dirname(abs), targetAbs)
  if (existing && !(existing.isSymbolicLink() && fs.readlinkSync(abs) === relative)) {
    throw applyFailed(`${action.path} is occupied`)
  }
  if (!existing) {
    ensureDirs(state, path.dirname(abs))
    try {
      state.symlink(relative, abs)
    } catch {
      copyTree(state, targetAbs, abs)
      return
    }
  }
  upsertEntry(state.manifest, { kind: 'link', path: action.path, target: action.target, createdByInstaller: true })
}

function applyBlock(state, action) {
  const abs = path.join(state.root, action.path)
  const target = assertEditable(state.root, abs)
  const exists = lstatOrNull(target) !== null
  const text = exists ? fs.readFileSync(target, 'utf8') : ''
  const eol = detectEol(text)
  const block = toEol(buildBlock(state.manifest.options.docsDir ?? DEFAULT_DOCS_DIR), eol)
  const previous = findEntry(state.manifest, 'block', action.path)
  if (action.op === 'block' && exists && sha256(text) !== action.diskSha && inspectBlock(text).state !== 'present') {
    throw applyFailed(`${action.path} changed since the plan was printed`)
  }
  let next
  let entry
  if (action.op === 'update-block') {
    next = replaceBlock(text, block)
    entry = { ...previous, sha256: sha256(block), eol }
  } else if (inspectBlock(text).state === 'present' && previous && sha256(extractBlock(text)) === sha256(block)) {
    return
  } else {
    const inserted = insertBlock(text, block, eol)
    next = inserted.text
    entry = { kind: 'block', path: action.path, sha256: sha256(block), prefix: inserted.prefix, createdFile: !exists, eol }
  }
  upsertEntry(state.manifest, entry)
  saveManifest(state.root, state.manifest)
  if (!exists) ensureDirs(state, path.dirname(target))
  atomicWrite(target, next, exists ? fs.statSync(target).mode & 0o777 : undefined)
}

function applyConfig(state, action) {
  const previous = readConfig(state.root, action.key, true)
  upsertEntry(state.manifest, { kind: 'gitconfig', path: action.path, key: action.key, value: action.value, previous })
  saveManifest(state.root, state.manifest)
  setLocalConfig(state.root, action.key, action.value)
}

const RUNNERS = {
  'create-file': writeHarnessFile,
  'update-file': writeHarnessFile,
  'delete-file': deleteHarnessFile,
  link: applyLink,
  block: applyBlock,
  'update-block': applyBlock,
  config: applyConfig,
  forget: (state, action) => removeEntry(state.manifest, action.kind, action.path),
  'retire-dir': (state, action) => {
    retireDir(state.root, action.path)
    removeEntry(state.manifest, 'dir', action.path)
  },
  skip: () => {},
  note: () => {},
}

export function newManifest(plan, abmhExisted) {
  return {
    schema: 1,
    harnessVersion: plan.harnessVersion,
    options: plan.options,
    status: 'pending',
    entries: [{ kind: 'dir', path: '.abmh', createdByInstaller: !abmhExisted }],
  }
}

export function applyPlan(ctx, plan, inject = {}) {
  const { root } = ctx
  const abmhExisted = lstatOrNull(path.join(root, '.abmh')) !== null
  const release = acquireLock(root)
  try {
    const manifest = ctx.manifest ?? newManifest(plan, abmhExisted)
    Object.assign(manifest, { status: 'pending', command: plan.command, planId: plan.id, plan: plan.actions, options: plan.options })
    saveManifest(root, manifest)
    const state = { root, manifest, symlink: inject.symlink ?? fs.symlinkSync }
    plan.actions.forEach((action, index) => {
      inject.beforeAction?.(index)
      RUNNERS[action.op](state, action)
      saveManifest(root, manifest)
    })
    for (const key of ['command', 'planId', 'plan']) delete manifest[key]
    Object.assign(manifest, { status: 'complete', harnessVersion: plan.harnessVersion })
    saveManifest(root, manifest)
  } finally {
    release()
  }
}
