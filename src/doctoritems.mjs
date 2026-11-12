import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { extractBlock } from './block.mjs'
import { fileSha, lstatOrNull, sha256 } from './fsutil.mjs'
import { readConfig } from './git.mjs'
import { harnessVersion } from './harness.mjs'
import { decideHook } from './hooks.mjs'
import { readBlockState } from './plan.mjs'

export const OK = 'OK'
export const FAIL = 'FAIL'
export const NOT_RUN = 'NOT RUN'

const item = (id, status, title, details = [], fix = null) => ({ id, status, title, details, fix })

const HARNESS_PREFIX = '.abmh/'
const REQUIRED_DOCS = ['LEEME.md', 'STATUS.md', 'MEMORY.md', 'GAPS.md']
const RULE_GATES = ['seguridad', 'despliegue']

export function checkManifest({ manifest, manifestError, name }) {
  const title = 'manifest and harness version'
  if (manifestError) return item('D1', FAIL, title, [manifestError], 'restore .abmh/manifest.json from git, or remove the damaged install by hand and run init again')
  if (!manifest) return item('D1', FAIL, title, ['no .abmh/manifest.json: the harness is not installed here'], `${name} init`)
  if (manifest.status !== 'complete') return item('D1', FAIL, title, ['the install was interrupted'], `run ${name} init again to resume it`)
  const tool = harnessVersion()
  if (manifest.harnessVersion !== tool) return item('D1', FAIL, title, [`installed ${manifest.harnessVersion}, this tool carries ${tool}`], `${name} update`)
  return item('D1', OK, title)
}

function blockProblem(root, entry) {
  try {
    const { status, text } = readBlockState(root, entry.path)
    if (status.state === 'absent') return `${entry.path}: harness block missing`
    return sha256(extractBlock(text)) === entry.sha256 ? null : `${entry.path}: harness block edited by hand`
  } catch {
    return `${entry.path}: harness block markers are broken`
  }
}

function entryProblem(root, entry) {
  if (entry.kind === 'block') return blockProblem(root, entry)
  if (entry.kind === 'link') {
    const abs = path.join(root, entry.path)
    if (!lstatOrNull(abs)?.isSymbolicLink()) return `${entry.path}: link missing`
    const points = path.resolve(path.dirname(abs), fs.readlinkSync(abs))
    if (points !== path.resolve(root, entry.target)) return `${entry.path}: link points somewhere else`
    return fs.existsSync(abs) ? null : `${entry.path}: link target is missing`
  }
  if (entry.kind !== 'file' || !entry.path.startsWith(HARNESS_PREFIX) || entry.path === '.abmh/harness.yaml') return null
  const disk = fileSha(path.join(root, entry.path))
  if (disk === null) return `${entry.path}: missing`
  return disk === entry.sha256 ? null : `${entry.path}: edited by hand`
}

export function checkFiles({ root, manifest, name }) {
  const title = 'harness files, links and blocks untouched'
  const problems = manifest.entries.map((entry) => entryProblem(root, entry)).filter(Boolean)
  if (problems.length === 0) return item('D2', OK, title)
  return item('D2', FAIL, title, problems, `restore them from git, or keep the edit: ${name} update never overwrites an edited file and restores a missing one`)
}

const hookFix = '.abmh/hooks'

export function checkHook({ root, top, manifest }) {
  const title = 'git hook installed in this clone'
  const entry = manifest.entries.find((candidate) => candidate.kind === 'gitconfig' && candidate.key === 'core.hooksPath')
  if (!entry) {
    const decision = decideHook(root, top, manifest.options?.noHooks === true)
    if (!decision.install) return item('D3', NOT_RUN, title, [`no harness hook: ${decision.reason}`, 'the secret scan and gate checks run only in the CI'])
    return item('D3', FAIL, title, ['the hook was never installed'], `git config core.hooksPath ${hookFix}`)
  }
  const current = readConfig(root, 'core.hooksPath')
  const script = path.join(root, entry.value, 'pre-push')
  if (current !== entry.value) return item('D3', FAIL, title, [`core.hooksPath is ${current ?? 'unset'}, expected ${entry.value}`], `git config core.hooksPath ${entry.value}`)
  try {
    fs.accessSync(script, fs.constants.X_OK)
  } catch {
    return item('D3', FAIL, title, [`${entry.value}/pre-push is missing or not executable`], `chmod +x ${entry.value}/pre-push`)
  }
  return item('D3', OK, title)
}

const yamlValue = (root, key) => fs.readFileSync(path.join(root, '.abmh/harness.yaml'), 'utf8').match(new RegExp(`^${key}: *(.*)$`, 'm'))?.[1].trim() ?? null

export function checkPacks({ root, manifest, name }) {
  const title = 'packs match harness.yaml'
  if (lstatOrNull(path.join(root, '.abmh/harness.yaml')) === null) return item('D4', FAIL, title, ['.abmh/harness.yaml is missing'], `${name} update`)
  const wanted = (manifest.options?.packs ?? []).join(',')
  const listed = (yamlValue(root, 'packs') ?? '').split(',').map((pack) => pack.trim()).filter(Boolean).join(',')
  if (wanted !== listed) return item('D4', FAIL, title, [`harness.yaml lists "${listed}", the install has "${wanted}"`], `${name} update --packs <ids>`)
  if (manifest.options?.stackPending === true || yamlValue(root, 'stack') === 'pending') {
    return item('D4', NOT_RUN, title, ['the stack was not detected, so no stack pack is installed'], `${name} update --packs code-kotlin (or code-astro-react)`)
  }
  return item('D4', OK, title)
}

export function checkDocs({ root, manifest, name }) {
  const title = 'required docs exist'
  const docs = manifest.options?.docsDir ?? '00-docs'
  const missing = [...REQUIRED_DOCS.map((file) => `${docs}/${file}`), `${docs}/decisions`].filter((rel) => lstatOrNull(path.join(root, rel)) === null)
  if (missing.length === 0) return item('D5', OK, title)
  return item('D5', FAIL, title, missing.map((rel) => `${rel}: missing`), `${name} update restores a missing file`)
}

const RULE_FIX = { 'DEP-02': 'RELEASE.md', 'DEP-03': 'RECOVERY.md' }

function parseRules(output, docs) {
  const items = []
  for (const text of output.split('\n')) {
    const match = text.match(/^(PASS|FAIL|NOT RUN) ([A-Z]+-[0-9]+) (.*)$/)
    if (match) {
      const status = { PASS: OK, FAIL, 'NOT RUN': NOT_RUN }[match[1]]
      const file = RULE_FIX[match[2]]
      const fix = status === FAIL ? (file ? `fill the fields in ${docs}/${file}` : 'correct the cause listed above, then run doctor again') : null
      items.push(item(match[2], status, match[3].slice(0, 90), [], fix))
    } else if (items.length > 0 && text.startsWith('  ')) items.at(-1).details.push(text.trim())
  }
  return items
}

export function checkRules({ root, manifest }) {
  const script = path.join(root, '.abmh/checks/check.sh')
  if (lstatOrNull(script) === null) return [item('D6', NOT_RUN, 'rule checks', ['.abmh/checks/check.sh is not installed'])]
  const docs = manifest.options?.docsDir ?? '00-docs'
  return RULE_GATES.flatMap((gate) => {
    const result = spawnSync('sh', [script, gate], { cwd: root, encoding: 'utf8' })
    const parsed = parseRules(result.stdout ?? '', docs)
    return parsed.length > 0 ? parsed : [item(`D6-${gate}`, NOT_RUN, `rule checks for ${gate}`, [`no result (exit ${result.status})`])]
  })
}
