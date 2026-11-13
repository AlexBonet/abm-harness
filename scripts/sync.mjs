import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256, walkFiles } from '../src/fsutil.mjs'
import { TOKENS, render } from '../src/render.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HARNESS = path.resolve(HERE, '../harness')

export const MAPPINGS = [
  { from: 'core/AGENT_BASELINE.md', to: '_system/AGENT_BASELINE.md' },
  { from: 'core/templates', to: '_system/templates', owns: () => true },
  { from: 'core/protocols', to: '_system/protocols', owns: () => true },
  { from: 'core/review', to: '_system/review', owns: (rel) => !rel.startsWith('fixtures/') },
  { from: 'skills/spec', to: '.claude/skills/spec', owns: () => true },
  { from: 'skills/grill', to: '.claude/skills/grill', owns: () => true },
  { from: 'skills/wizard', to: '.claude/skills/wizard', owns: () => true },
  { from: 'skills/diagnose', to: '.claude/skills/diagnose', owns: () => true },
  { from: 'skills/abms-spec-review', to: '.claude/skills/abms-spec-review', owns: () => true },
  { from: 'agents', to: '.claude/agents', only: (rel) => rel.startsWith('abms-review-'), owns: (rel) => rel.startsWith('abms-review-') },
  { from: 'agents', to: '_system/agents', only: (rel) => !rel.startsWith('abms-review-'), owns: () => true },
  { from: 'lanes', to: '_system/lanes', owns: () => true },
  { from: 'gates', to: '_system/gates', owns: () => true },
  { from: 'strict.md', to: '_system/strict.md' },
  { from: 'packs', to: '_system/packs', owns: () => true },
  { from: 'checks', to: '_system/checks', owns: () => true },
  { from: 'reviewer', to: '_system/reviewer', owns: () => true },
  { from: 'hooks/pre-push', to: 'tools/git-hooks/pre-push' },
]

export const sourceFiles = (harness = HARNESS) =>
  walkFiles(harness)
    .filter((rel) => rel !== 'VERSION')
    .map((rel) => ({ rel, text: fs.readFileSync(path.join(harness, rel), 'utf8'), executable: (fs.statSync(path.join(harness, rel)).mode & 0o111) !== 0 }))

const INSTALL_ONLY = (rel) => rel === 'profiles.json' || rel === 'packs.json' || rel.startsWith('project/') || rel.startsWith('ci/')

export const versionOf = (files) =>
  sha256(`${JSON.stringify(TOKENS)}\n${files.map((file) => `${file.rel}\n${file.executable}\n${file.text}`).join('\n--\n')}`).slice(0, 12)

const insideMapping = (mapping, rel) => {
  if (rel === mapping.from) return true
  if (!rel.startsWith(`${mapping.from}/`)) return false
  return mapping.only ? mapping.only(rel.slice(mapping.from.length + 1)) : true
}

export function buildRoot(files) {
  return MAPPINGS.flatMap((mapping) =>
    files
      .filter((file) => insideMapping(mapping, file.rel))
      .map((file) => ({
        rel: path.posix.join(mapping.to, file.rel.slice(mapping.from.length)),
        text: render(file.text, 'root'),
        executable: file.executable,
      })),
  )
}

export function drift(files, root, harness = HARNESS) {
  const problems = []
  const built = buildRoot(files)
  for (const file of built) {
    const abs = path.join(root, file.rel)
    if (!fs.existsSync(abs)) problems.push(`missing: ${file.rel}`)
    else if (fs.readFileSync(abs, 'utf8') !== file.text) problems.push(`differs: ${file.rel}`)
    else if (((fs.statSync(abs).mode & 0o111) !== 0) !== file.executable) problems.push(`mode: ${file.rel}`)
  }
  const wanted = new Set(built.map((file) => file.rel))
  for (const mapping of MAPPINGS.filter((entry) => entry.owns)) {
    const base = path.join(root, mapping.to)
    if (!fs.existsSync(base)) continue
    for (const rel of walkFiles(base).filter(mapping.owns)) {
      const full = path.posix.join(mapping.to, rel)
      if (!wanted.has(full)) problems.push(`extra: ${full}`)
    }
  }
  for (const file of files) {
    if (!INSTALL_ONLY(file.rel) && !MAPPINGS.some((mapping) => insideMapping(mapping, file.rel))) problems.push(`unmapped: harness/${file.rel}`)
  }
  const versionFile = path.join(harness, 'VERSION')
  const recorded = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : null
  if (recorded !== versionOf(files)) problems.push('differs: harness/VERSION')
  return problems
}

function write(files, root, harness) {
  for (const file of buildRoot(files)) {
    const abs = path.join(root, file.rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, file.text, { mode: file.executable ? 0o755 : 0o644 })
    fs.chmodSync(abs, file.executable ? 0o755 : 0o644)
  }
  fs.writeFileSync(path.join(harness, 'VERSION'), `${versionOf(files)}\n`)
}

function main(argv) {
  const rootFlag = argv.indexOf('--root')
  if (rootFlag >= 0 && (argv[rootFlag + 1] === undefined || argv[rootFlag + 1].startsWith('--'))) {
    console.error('sync: --root needs a directory')
    return 2
  }
  const root = path.resolve(rootFlag >= 0 ? argv[rootFlag + 1] : path.join(HERE, '../..'))
  const files = sourceFiles()
  if (argv.includes('--check')) {
    if (!fs.existsSync(path.join(root, '_system/AGENT_BASELINE.md'))) {
      console.error(`sync --check: NOT RUN, no ABMS root at ${root}`)
      return 3
    }
    const problems = drift(files, root)
    if (problems.length > 0) {
      console.error(`sync --check: ${root} drifted from harness/\n${problems.join('\n')}`)
      return 1
    }
    console.log('sync --check: the root matches harness/')
    return 0
  }
  write(files, root, HARNESS)
  console.log(`sync: wrote ${buildRoot(files).length} files to ${root} (version ${versionOf(files)})`)
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2))
