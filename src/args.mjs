import { usageError } from './errors.mjs'
import { parsePacks } from './packs.mjs'
import { parseProfile } from './profiles.mjs'
import { parseDocsDir } from './settings.mjs'

export const ASSISTANTS = ['claude', 'codex', 'gemini', 'cursor', 'opencode']
export const LANGS = ['es', 'en']

const COMMANDS = ['init', 'update', 'remove', 'migrate', 'doctor']
const VALUE_FLAGS = ['assistants', 'lang', 'profile', 'docs-dir', 'accept-plan', 'root', 'restore', 'backup-dir', 'packs']
const BOOLEAN_FLAGS = ['no-hooks', 'ci', 'yes']
const INIT_ONLY = ['assistants', 'lang', 'profile', 'no-hooks', 'ci', 'yes']
const MIGRATE_ONLY = ['restore', 'backup-dir']

function parseAssistants(value) {
  if (value === undefined) return [...ASSISTANTS]
  const requested = value.split(',').map((name) => name.trim()).filter(Boolean)
  const unknown = requested.filter((name) => !ASSISTANTS.includes(name))
  if (unknown.length > 0 || requested.length === 0) {
    throw usageError(`unknown assistant: ${unknown.join(', ') || value}. Valid: ${ASSISTANTS.join(', ')}`)
  }
  return ASSISTANTS.filter((name) => requested.includes(name))
}

function parseLang(value) {
  if (value === undefined) return 'es'
  if (!LANGS.includes(value)) throw usageError(`invalid --lang ${value}. Valid: ${LANGS.join(', ')}`)
  return value
}

function readFlags(rest) {
  const flags = {}
  for (let index = 0; index < rest.length; index += 1) {
    const raw = rest[index]
    if (!raw.startsWith('--')) throw usageError(`unexpected argument: ${raw}`)
    const [name, inline] = raw.slice(2).split(/=(.*)/s)
    if (BOOLEAN_FLAGS.includes(name)) {
      flags[name] = true
      continue
    }
    if (!VALUE_FLAGS.includes(name)) throw usageError(`unknown flag: --${name}`)
    const value = inline ?? rest[(index += 1)]
    if (value === undefined || value.startsWith('--')) throw usageError(`--${name} needs a value`)
    flags[name] = value
  }
  return flags
}

export function parseArgs(argv) {
  const [command, ...rest] = argv
  if (!COMMANDS.includes(command)) throw usageError(`usage: abmh <${COMMANDS.join('|')}> [flags]`)
  const flags = readFlags(rest)
  if (command !== 'init') {
    for (const name of INIT_ONLY) {
      if (name in flags) throw usageError(`--${name} only applies to init`)
    }
  }
  if (command === 'doctor') {
    for (const name of ['accept-plan', 'docs-dir']) {
      if (name in flags) throw usageError(`--${name} does not apply to doctor`)
    }
  }
  if ('packs' in flags && !['init', 'update'].includes(command)) throw usageError('--packs only applies to init and update')
  if (command !== 'migrate') {
    for (const name of MIGRATE_ONLY) {
      if (name in flags) throw usageError(`--${name} only applies to migrate`)
    }
  } else if ('docs-dir' in flags) {
    throw usageError('--docs-dir does not apply to migrate')
  }
  return {
    command,
    restore: flags.restore ?? null,
    backupDir: flags['backup-dir'] ?? null,
    assistants: parseAssistants(flags.assistants),
    lang: parseLang(flags.lang),
    profile: parseProfile(flags.profile),
    docsDir: parseDocsDir(flags['docs-dir']),
    packs: parsePacks(flags.packs),
    noHooks: flags['no-hooks'] === true,
    ci: flags.ci === true,
    acceptPlan: flags['accept-plan'] ?? null,
    root: flags.root ?? null,
  }
}
