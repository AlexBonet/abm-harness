import { applyPlan } from './apply.mjs'
import { parseArgs } from './args.mjs'
import { AbmhError, EXIT, planChanged, refused, usageError } from './errors.mjs'
import { formatPlan } from './format.mjs'
import { runDoctor } from './doctor.mjs'
import { runMigrate } from './docsmove.mjs'
import { harnessVersion } from './harness.mjs'
import { readManifest } from './manifest.mjs'
import { resolveRoot } from './paths.mjs'
import { freshPlan, updatePlan } from './plan.mjs'
import { applyRemove, removePlan } from './remove.mjs'
import { DEFAULT_DOCS_DIR, DOCS_LAYOUT } from './settings.mjs'

function resumePlan(manifest) {
  return {
    command: manifest.command,
    options: manifest.options,
    harnessVersion: manifest.harnessVersion,
    actions: manifest.plan,
    id: manifest.planId,
    resume: true,
  }
}

function choosePlan(args, ctx) {
  const { manifest } = ctx
  if (args.command === 'remove') {
    if (!manifest) throw refused('abm-harness is not installed here (no .abmh/manifest.json)')
    return removePlan(ctx)
  }
  if (manifest?.status === 'pending') return resumePlan(manifest)
  if (args.command === 'init') {
    return manifest ? { none: 'already installed; nothing to do. Use update to refresh it.' } : freshPlan(ctx)
  }
  if (!manifest) throw refused('abm-harness is not installed here (no .abmh/manifest.json)')
  const plan = updatePlan({ ...ctx, options: updateOptions(manifest, args) })
  return plan.actions.length === 0 ? { none: 'already up to date; nothing to do.' } : plan
}

function legacyDocsDir(stored) {
  if (stored === undefined) return DEFAULT_DOCS_DIR
  const parent = stored.replace(/\/+$/, '').split('/').slice(0, -1).join('/')
  if (parent === '') throw refused(`this install keeps its decisions in ${stored}/ with no parent folder; run remove and init again`)
  return parent
}

function updateOptions(manifest, args) {
  const stored = { profile: 'abm-estricto', ...manifest.options }
  const legacy = stored.docsLayout !== DOCS_LAYOUT
  const current = legacy ? (args.docsDir === null ? legacyDocsDir(stored.docsDir) : args.docsDir) : stored.docsDir
  const options = { ...stored, docsDir: current ?? DEFAULT_DOCS_DIR, docsLayout: DOCS_LAYOUT }
  if (args.docsDir === null) return options
  if (args.docsDir !== options.docsDir && args.docsDir.toLowerCase() === options.docsDir.toLowerCase()) {
    throw usageError(`--docs-dir ${args.docsDir} differs from ${options.docsDir} only by letter case; pick another name`)
  }
  return { ...options, docsDir: args.docsDir }
}

function execute(args, io) {
  if (args.command === 'migrate') return runMigrate(args, io)
  if (args.command === 'doctor') return runDoctor(args, io)
  const { root, top } = resolveRoot(io.cwd, args.root)
  const manifest = readManifest(root)
  const options = { assistants: args.assistants, lang: args.lang, profile: args.profile, docsDir: args.docsDir ?? DEFAULT_DOCS_DIR, docsLayout: DOCS_LAYOUT, noHooks: args.noHooks }
  const needsHarness = args.command !== 'remove'
  const ctx = { root, top, manifest, options, requestedPacks: args.packs, ci: args.ci, harnessVersion: needsHarness ? harnessVersion() : null }
  const plan = choosePlan(args, ctx)
  if (plan.none) return io.out(plan.none)
  if (args.acceptPlan === null) return io.out(formatPlan(plan, args, root, io.invokedAs))
  if (args.acceptPlan !== plan.id) throw planChanged()
  const planCtx = { ...ctx, options: plan.options }
  if (plan.command === 'remove') applyRemove(planCtx, plan, io.inject)
  else applyPlan(planCtx, plan, io.inject)
  return io.out(`${plan.command} done: ${plan.actions.length} actions applied (plan ${plan.id.slice(0, 12)})`)
}

export function run(argv, io = {}) {
  const full = {
    cwd: io.cwd ?? process.cwd(),
    out: io.out ?? console.log,
    err: io.err ?? console.error,
    invokedAs: io.invokedAs ?? 'abmh',
    inject: io.inject ?? {},
  }
  try {
    const result = execute(parseArgs(argv), full)
    return result?.exitCode ?? EXIT.OK
  } catch (error) {
    if (error instanceof AbmhError) {
      full.err(error.message)
      return error.code
    }
    full.err(`ABMH_APPLY_FAILED: ${error.message}`)
    return EXIT.APPLY_FAILED
  }
}
