import { usageError } from './errors.mjs'

export const SETTINGS_PATH = '.abmh/harness.yaml'
export const DEFAULT_PROFILE = 'universal'
export const DEFAULT_DOCS_DIR = '00-docs'
export const DOCS_LAYOUT = 2

export function parseDocsDir(value) {
  if (value === undefined) return null
  const clean = value.replace(/\/+$/, '')
  const parts = clean.split('/')
  const reserved = parts.some((part) => ['', '.', '..', '.git'].includes(part.toLowerCase())) || parts[0].toLowerCase() === '.abmh'
  if (reserved || !/^[\p{L}\p{N}._/-]+$/u.test(clean) || clean.startsWith('/')) throw usageError(`invalid --docs-dir ${value}. Use a relative folder inside the project`)
  return clean
}

export const formatSettings = ({ version, profile, docsDir, packs, pending }) =>
  `version: ${version}\nprofile: ${profile}\ndocsDir: ${docsDir}\nreviewer: opposite\npacks: ${packs.join(',')}\n${pending ? 'stack: pending\n' : ''}`
