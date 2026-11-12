import fs from 'node:fs'
import path from 'node:path'
import { hooksDir, readConfig } from './git.mjs'

const LEFTHOOK_FILES = ['lefthook.yml', 'lefthook.yaml', 'lefthook.json', 'lefthook.toml', '.lefthook.yml', '.lefthook.yaml']

function ownHooksReason(root) {
  if (readConfig(root, 'core.hooksPath') !== null) return 'core.hooksPath is already set'
  const dir = hooksDir(root)
  if (fs.existsSync(dir) && fs.readdirSync(dir).some((name) => !name.endsWith('.sample'))) {
    return 'the repository has its own hooks'
  }
  if (fs.existsSync(path.join(root, '.husky'))) return 'husky is configured'
  if (LEFTHOOK_FILES.some((name) => fs.existsSync(path.join(root, name)))) return 'lefthook is configured'
  return null
}

export function decideHook(root, top, noHooks) {
  if (noHooks) return { install: false, reason: 'skipped by --no-hooks' }
  if (top === null) return { install: false, reason: 'not a git repository' }
  if (top !== root) return { install: false, reason: 'the root is not the repository top level' }
  const reason = ownHooksReason(root)
  return reason ? { install: false, reason } : { install: true, reason: null }
}
