import fs from 'node:fs'
import path from 'node:path'
import { sha256, toPosix } from './fsutil.mjs'

export const OLD_DIR = 'shared-domain'
export const NEW_DIR = '00-docs'

const OLD_TEXT = `${OLD_DIR}/`
const NEW_TEXT = `${NEW_DIR}/`
const EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.sh', '.ts', '.js'])
const SKIP_DIRS = new Set(['node_modules', '.git', '.abmh'])
const MAX_BYTES = 1024 * 1024
const CONTROL = /[\u0000-\u001f]/

const OLD_PATTERN = /(?<![\w-])shared-domain\//g

export const rewrite = (text) => text.replace(OLD_PATTERN, NEW_TEXT)

export const mapped = (rel) => (rel === OLD_DIR || rel.startsWith(OLD_TEXT) ? `${NEW_DIR}${rel.slice(OLD_DIR.length)}` : rel)

export const insideOld = (rel) => rel === OLD_DIR || rel.startsWith(OLD_TEXT)

const countOf = (text, needle) => text.split(needle).length - 1

const replaceCount = (text) => (text.match(OLD_PATTERN) ?? []).length

const mentionCount = (text) => countOf(text, OLD_DIR) - replaceCount(text)

function firstMention(text) {
  const lines = text.split('\n')
  const index = lines.findIndex((line) => countOf(line, OLD_DIR) - (line.match(OLD_PATTERN) ?? []).length > 0)
  return { line: index + 1, snippet: lines[index].trim().slice(0, 80) }
}

function inspect(full, rel, result) {
  const stat = fs.lstatSync(full)
  if (stat.isSymbolicLink()) {
    result.skipped.push({ path: rel, reason: 'symbolic link, not followed' })
    return
  }
  if (stat.size > MAX_BYTES) {
    result.skipped.push({ path: rel, reason: 'larger than 1 MB, not read' })
    return
  }
  if (CONTROL.test(rel)) {
    result.skipped.push({ path: rel, reason: 'name has control characters, not read' })
    return
  }
  const data = fs.readFileSync(full)
  if (data.includes(0)) {
    result.skipped.push({ path: rel, reason: 'binary, not read' })
    return
  }
  const text = data.toString('utf8')
  if (Buffer.from(text, 'utf8').compare(data) !== 0) {
    result.skipped.push({ path: rel, reason: 'not valid UTF-8, not read' })
    return
  }
  const count = replaceCount(text)
  if (count > 0) result.edited.push({ path: rel, count, sha256: sha256(data) })
  const kept = mentionCount(text)
  if (kept > 0) result.mentions.push({ path: rel, count: kept, ...firstMention(text) })
}

export function scanProject(root) {
  const result = { edited: [], mentions: [], skipped: [] }
  const visit = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      const rel = toPosix(path.relative(root, full))
      if (entry.name.startsWith('.env')) {
        continue
      } else if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(full)
      } else if ((entry.isFile() || entry.isSymbolicLink()) && EXTENSIONS.has(path.extname(entry.name))) {
        inspect(full, rel, result)
      }
    }
  }
  visit(root)
  return result
}
