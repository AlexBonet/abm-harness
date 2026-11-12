import fs from 'node:fs'
import path from 'node:path'
import { extractBlock, inspectBlock, normalizeEol } from './block.mjs'
import { desiredState } from './desired.mjs'
import { refused } from './errors.mjs'
import { canonicalJson, fileSha, lstatOrNull, sha256 } from './fsutil.mjs'
import { decideHook } from './hooks.mjs'
import { renderHarnessFile } from './harness.mjs'
import { findEntry } from './manifest.mjs'
import { retireActions } from './migrate.mjs'
import { packNotes, selectPacks } from './packs.mjs'
import { detectData, detectInterface, detectStacks } from './stacks.mjs'
import { assertEditable, assertInside } from './paths.mjs'

export function makePlan(command, ctx, actions) {
  const base = { command, options: ctx.options, harnessVersion: ctx.harnessVersion, actions }
  return { ...base, id: sha256(canonicalJson(base)) }
}

const safe = (root, action) => {
  assertInside(root, path.join(root, action.path))
  return action
}

function linkAction(root, spec) {
  const abs = path.join(root, spec.path)
  assertInside(root, abs)
  if (lstatOrNull(abs) === null) {
    return { op: 'link', group: spec.group, path: spec.path, target: spec.target, reason: 'expose to the assistant' }
  }
  return { op: 'skip', group: spec.group, path: spec.path, reason: 'path occupied, left untouched' }
}

export function readBlockState(root, blockPath) {
  const target = assertEditable(root, path.join(root, blockPath))
  const exists = lstatOrNull(target) !== null
  const text = exists ? fs.readFileSync(target, 'utf8') : ''
  const status = inspectBlock(text)
  if (status.state === 'broken') throw refused(`${blockPath}: unbalanced or duplicate abmh markers (${status.detail})`)
  return { exists, text, status, diskSha: exists ? sha256(text) : null }
}

function blockAction(root, block) {
  const { exists, status, diskSha } = readBlockState(root, block.path)
  if (status.state === 'present') {
    return { op: 'skip', group: 'instructions', path: block.path, reason: 'an abmh block is already there, not installed by abm-harness' }
  }
  return {
    op: 'block',
    group: 'instructions',
    path: block.path,
    blockSha: block.sha256,
    diskSha,
    reason: exists ? 'add the harness block to the existing file' : 'create the file with the harness block',
  }
}

function hookActions(hook) {
  if (hook.install) {
    return [{ op: 'config', group: 'hooks', path: '.git/config', key: 'core.hooksPath', value: '.abmh/hooks', reason: 'run the harness git hook' }]
  }
  return [{ op: 'skip', group: 'hooks', path: 'git hook', reason: hook.reason }]
}

function freshFileAction(root, file) {
  const base = { op: 'create-file', group: 'harness', reason: 'harness file', ...file }
  const disk = fileSha(path.join(root, file.path))
  if (disk === null || disk === file.sha256) return safe(root, base)
  return { op: 'skip', group: base.group, path: file.path, reason: 'exists, not installed by abm-harness' }
}

function docsNotes(root, docsDir, state) {
  const abs = path.join(root, docsDir)
  assertInside(root, abs)
  const collides = state.files.some(
    (file) => file.group === 'docs' && fileSha(path.join(root, file.path)) !== null && fileSha(path.join(root, file.path)) !== file.sha256,
  )
  if (!collides) return []
  return [{
    op: 'skip',
    group: 'docs',
    path: docsDir,
    reason: `the folder already has files that are not from abm-harness; to keep them apart use --docs-dir ${docsDir}-abmh`,
  }]
}

const CI_PATH = '.github/workflows/abmh-ci.yml'
const CI_SOURCE = 'ci/abmh-ci.yml'

function hasWorkflow(root) {
  try {
    return fs.readdirSync(path.join(root, '.github/workflows')).some((name) => /\.ya?ml$/.test(name))
  } catch {
    return false
  }
}

function ciActions(root, ctx) {
  if (ctx.ci) {
    const content = renderHarnessFile(CI_SOURCE, ctx.options.lang)
    return [freshFileAction(root, { path: CI_PATH, source: CI_SOURCE, sha256: sha256(content), mode: 0o644, group: 'ci', reason: 'CI workflow template, written because --ci was given' })]
  }
  if (hasWorkflow(root)) return []
  return [{ op: 'note', group: 'ci', path: CI_PATH, reason: 'a CI template (pnpm: lint, typecheck, test, verify.sh) is available; add --ci to write it' }]
}

export function freshPlan(ctx) {
  const { root, options } = ctx
  if (lstatOrNull(path.join(root, '.abmh')) !== null) {
    throw refused('.abmh/ already exists and was not created by abm-harness; nothing was touched')
  }
  const hook = decideHook(root, ctx.top, options.noHooks)
  const selection = selectPacks({ profile: options.profile, detected: [...detectStacks(root), ...detectData(root), ...detectInterface(root)], requested: ctx.requestedPacks, stored: null })
  const planOptions = { ...options, packs: selection.ids, stackPending: selection.pending }
  const state = desiredState({ options: planOptions, installHook: hook.install, version: ctx.harnessVersion })
  const actions = [
    ...packNotes(selection, []),
    ...ciActions(root, ctx),
    ...docsNotes(root, options.docsDir, state),
    ...state.files.map((file) => freshFileAction(root, file)),
    ...state.links.map((spec) => linkAction(root, spec)),
    ...state.blocks.map((block) => blockAction(root, block)),
    ...hookActions(hook),
  ]
  return makePlan('init', { ...ctx, options: planOptions }, actions)
}

function fileActions(root, state, manifest) {
  const actions = []
  const wanted = new Set(state.files.map((file) => file.path))
  for (const file of state.files) {
    const entry = findEntry(manifest, 'file', file.path)
    const disk = fileSha(path.join(root, file.path))
    const base = { group: 'harness', ...file }
    if (!entry && disk !== null) {
      actions.push({ op: 'skip', group: base.group, path: file.path, reason: 'exists, not installed by abm-harness' })
    } else if (disk === null) {
      actions.push(safe(root, { op: 'create-file', ...base, reason: entry ? 'missing, restored' : base.reason ?? 'new in the harness' }))
    } else if (disk !== entry.sha256) {
      actions.push({ op: 'skip', group: base.group, path: file.path, reason: 'edited by hand, kept' })
    } else if (file.sha256 !== entry.sha256) {
      actions.push(safe(root, { op: 'update-file', ...base, diskSha: disk, reason: 'harness changed' }))
    }
  }
  for (const entry of manifest.entries.filter((e) => e.kind === 'file' && !e.copyOf && !wanted.has(e.path))) {
    const disk = fileSha(path.join(root, entry.path))
    if (disk === entry.sha256) {
      actions.push({ op: 'delete-file', group: 'harness', path: entry.path, diskSha: disk, reason: 'no longer in the harness' })
    } else if (disk === null) {
      actions.push({ op: 'forget', group: 'migration', kind: 'file', path: entry.path, reason: 'no longer in the harness and already gone, no longer tracked' })
    } else {
      actions.push({ op: 'forget', group: 'migration', kind: 'file', path: entry.path, reason: 'no longer in the harness but edited, kept in place and no longer tracked' })
    }
  }
  return actions
}

function blockUpdate(root, block, manifest) {
  const entry = findEntry(manifest, 'block', block.path)
  if (!entry) return [blockAction(root, block)]
  const { status, text, diskSha } = readBlockState(root, block.path)
  if (status.state === 'absent') return [blockAction(root, block)]
  const current = extractBlock(text)
  if (sha256(current) !== entry.sha256) {
    return [{ op: 'skip', group: 'instructions', path: block.path, reason: 'block edited by hand, kept' }]
  }
  if (normalizeEol(current) === block.text) return []
  return [{ op: 'update-block', group: 'instructions', path: block.path, blockSha: block.sha256, diskSha, reason: 'harness block changed' }]
}

function keepCi(state, manifest, lang) {
  if (!findEntry(manifest, 'file', CI_PATH)) return state
  const content = renderHarnessFile(CI_SOURCE, lang)
  return { ...state, files: [...state.files, { path: CI_PATH, source: CI_SOURCE, sha256: sha256(content), mode: 0o644, group: 'ci' }] }
}

export function updatePlan(ctx) {
  const { root, manifest } = ctx
  const installHook = manifest.entries.some((entry) => entry.kind === 'gitconfig')
  const stored = ctx.options.packs ?? null
  const selection = selectPacks({ profile: ctx.options.profile, detected: detectStacks(root), requested: ctx.requestedPacks, stored })
  const options = { ...ctx.options, packs: selection.ids, stackPending: selection.pending }
  const state = keepCi(desiredState({ options, installHook, version: ctx.harnessVersion }), manifest, options.lang)
  const fileOps = fileActions(root, state, manifest)
  const actions = [...packNotes(selection, stored ?? []), ...fileOps]
  for (const spec of state.links) {
    const installed = manifest.entries.some((entry) => entry.path === spec.path)
    if (!installed) actions.push(linkAction(root, spec))
  }
  for (const block of state.blocks) actions.push(...blockUpdate(root, block, manifest))
  actions.push(...retireActions(root, manifest, state, fileOps))
  return makePlan('update', { ...ctx, options }, actions)
}
