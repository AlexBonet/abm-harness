import { instructionFiles, linkSpecs } from './assistants.mjs'
import { buildBlock } from './block.mjs'
import { sha256 } from './fsutil.mjs'
import { harnessFiles, projectFiles } from './harness.mjs'
import { DEFAULT_DOCS_DIR, DEFAULT_PROFILE, SETTINGS_PATH, formatSettings } from './settings.mjs'

const CLAUDE_IGNORE_PATH = '.claude/.gitignore'
const CLAUDE_IGNORE = '*\n'

const docReason = (rel) =>
  rel.startsWith('project/decisions/') ? 'a place to record decisions' : rel.startsWith('project/tools/') ? 'a place to document connections' : 'project docs'

export function desiredState({ options, installHook, version }) {
  const files = harnessFiles(options.lang, options.profile, options.packs)
    .filter((file) => installHook || !file.rel.startsWith('hooks/'))
    .map((file) => ({ path: `.abmh/${file.rel}`, source: file.rel, sha256: file.sha, mode: file.mode }))
  const docsDir = options.docsDir ?? DEFAULT_DOCS_DIR
  const docs = projectFiles(options.lang, docsDir).map((file) => ({
    path: file.target,
    source: file.rel,
    sha256: file.sha,
    mode: 0o644,
    group: 'docs',
    reason: docReason(file.rel),
  }))
  const settings = formatSettings({
    version,
    profile: options.profile ?? DEFAULT_PROFILE,
    docsDir,
    packs: options.packs,
    pending: options.stackPending === true,
  })
  const generated = {
    path: SETTINGS_PATH,
    content: settings,
    sha256: sha256(settings),
    mode: 0o644,
  }
  const text = buildBlock(docsDir)
  const links = linkSpecs(options.assistants)
  const untracked = links.some((spec) => spec.path.startsWith('.claude/'))
    ? [{ path: CLAUDE_IGNORE_PATH, content: CLAUDE_IGNORE, sha256: sha256(CLAUDE_IGNORE), mode: 0o644, group: 'claude', reason: '.claude/ never goes to git' }]
    : []
  return {
    files: [...files, generated, ...untracked, ...docs],
    links,
    blocks: instructionFiles(options.assistants).map((file) => ({ path: file, text, sha256: sha256(text) })),
  }
}
