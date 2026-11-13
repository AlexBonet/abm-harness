import fs from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { applyFailed } from './errors.mjs'
import { atomicWrite, lstatOrNull, sha256 } from './fsutil.mjs'
import { assertEditable } from './paths.mjs'

export const CLAUDE_SETTINGS = '.claude/settings.json'
const GUARD = '.abmh/reviewer/guard.sh'
const EVENTS = { SessionStart: 'session-start', Stop: 'stop' }

const guardCommand = (mode) => `sh "$CLAUDE_PROJECT_DIR/${GUARD}" ${mode}`
const GUARD_COMMANDS = new Set(Object.values(EVENTS).map((mode) => guardCommand(mode)))
const isGuardHook = (hook) => GUARD_COMMANDS.has(hook?.command)
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function stripGroup(group) {
  if (!Array.isArray(group?.hooks)) return group
  const hooks = group.hooks.filter((hook) => !isGuardHook(hook))
  if (hooks.length === group.hooks.length) return group
  return hooks.length === 0 ? null : { ...group, hooks }
}

const stripGroups = (groups) => groups.map(stripGroup).filter((group) => group !== null)
const formatJson = (data) => `${JSON.stringify(data, null, 2)}\n`

function parse(text) {
  try {
    const data = JSON.parse(text)
    const hooksOk = data?.hooks === undefined || (isObject(data.hooks) && Object.values(data.hooks).every(Array.isArray))
    return isObject(data) && hooksOk ? data : null
  } catch {
    return null
  }
}

export function readClaudeSettings(root) {
  const abs = assertEditable(root, path.join(root, CLAUDE_SETTINGS))
  if (lstatOrNull(abs) === null) return { abs, exists: false, text: '', data: {} }
  const text = fs.readFileSync(abs, 'utf8')
  return { abs, exists: true, text, data: parse(text) }
}

export function withGuard(data) {
  const hooks = { ...(data.hooks ?? {}) }
  for (const [event, mode] of Object.entries(EVENTS)) {
    const kept = stripGroups(hooks[event] ?? [])
    hooks[event] = [...kept, { hooks: [{ type: 'command', command: guardCommand(mode) }] }]
  }
  return { ...data, hooks }
}

export function withoutGuard(data, original = null) {
  const hooks = {}
  for (const [event, groups] of Object.entries(data.hooks ?? {})) {
    const kept = stripGroups(groups)
    if (kept.length > 0 || groups.length === 0 || Array.isArray(original?.hooks?.[event])) hooks[event] = kept
  }
  const rest = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'hooks'))
  const keepHooks = Object.keys(hooks).length > 0 || (data.hooks !== undefined && isObject(original?.hooks))
  return keepHooks ? { ...rest, hooks } : rest
}

export function claudeHooksActions(root, options, installed) {
  if (!options.assistants?.includes('claude') || installed) return []
  if (options.noHooks) return [{ op: 'skip', group: 'hooks', path: CLAUDE_SETTINGS, reason: 'Claude review guard skipped by --no-hooks' }]
  const settings = readClaudeSettings(root)
  if (settings.data === null) {
    return [{ op: 'skip', group: 'hooks', path: CLAUDE_SETTINGS, reason: 'not valid JSON, left untouched; the Claude review guard is not installed' }]
  }
  return [{
    op: 'claude-hooks',
    group: 'hooks',
    path: CLAUDE_SETTINGS,
    diskSha: settings.exists ? sha256(settings.text) : null,
    reason: settings.exists ? 'add the review guard (Stop, SessionStart) to the existing settings' : 'create the settings with the review guard (Stop, SessionStart)',
  }]
}

export function writeGuard(root, action) {
  const settings = readClaudeSettings(root)
  if ((settings.exists ? sha256(settings.text) : null) !== action.diskSha || settings.data === null) {
    throw applyFailed(`${action.path} changed since the plan was printed`)
  }
  atomicWrite(settings.abs, formatJson(withGuard(settings.data)), settings.exists ? fs.statSync(settings.abs).mode & 0o777 : undefined)
  return { kind: 'claudehooks', path: action.path, createdFile: !settings.exists, original: settings.exists ? settings.text : null }
}

export function guardRemoval(root, entry) {
  const settings = readClaudeSettings(root)
  if (!settings.exists) return null
  if (settings.data === null) return { op: 'skip', group: 'remove', path: entry.path, reason: 'not valid JSON, kept' }
  return { op: 'remove-claude-hooks', group: 'remove', path: entry.path, diskSha: sha256(settings.text), createdFile: entry.createdFile, original: entry.original, reason: 'Claude review guard' }
}

export function removeGuard(root, action) {
  const settings = readClaudeSettings(root)
  if (sha256(settings.text) !== action.diskSha || settings.data === null) throw applyFailed(`${action.path} changed since the plan was printed`)
  const mode = fs.statSync(settings.abs).mode & 0o777
  const original = typeof action.original === 'string' ? parse(action.original) : null
  const rest = withoutGuard(settings.data, original)
  if (original !== null && isDeepStrictEqual(rest, withoutGuard(original, original))) return atomicWrite(settings.abs, action.original, mode)
  if (action.createdFile && Object.keys(rest).length === 0) return fs.rmSync(settings.abs)
  return atomicWrite(settings.abs, formatJson(rest), mode)
}
