import { AbmhError } from './errors.mjs'
import { resolveRoot } from './paths.mjs'
import { readManifest } from './manifest.mjs'
import { FAIL, NOT_RUN, OK, checkDocs, checkFiles, checkHook, checkManifest, checkPacks, checkRules } from './doctoritems.mjs'

const label = (status) => status.padEnd(8)

function render(item) {
  const lines = [`${label(item.status)}${item.id} ${item.title}`]
  for (const detail of item.details) lines.push(`${' '.repeat(8)}${detail}`)
  if (item.fix && item.status !== OK) lines.push(`${' '.repeat(8)}fix: ${item.fix}`)
  return lines.join('\n')
}

export function exitCodeOf(items) {
  if (items.some((entry) => entry.status === FAIL)) return 1
  return items.some((entry) => entry.status === NOT_RUN) ? 2 : 0
}

export function runDoctor(args, io) {
  const { root, top } = resolveRoot(io.cwd, args.root)
  let manifest = null
  let manifestError = null
  try {
    manifest = readManifest(root)
  } catch (error) {
    if (!(error instanceof AbmhError)) throw error
    manifestError = error.message
  }
  const ctx = { root, top, manifest, manifestError, name: io.invokedAs }
  const first = checkManifest(ctx)
  const items = manifest
    ? [first, checkFiles(ctx), checkHook(ctx), checkPacks(ctx), checkDocs(ctx), ...checkRules(ctx)]
    : [first]
  io.out(`${io.invokedAs} doctor for ${root}`)
  for (const entry of items) io.out(render(entry))
  const count = (status) => items.filter((entry) => entry.status === status).length
  io.out(`summary: ${count(OK)} OK, ${count(FAIL)} FAIL, ${count(NOT_RUN)} NOT RUN`)
  return { exitCode: exitCodeOf(items) }
}
