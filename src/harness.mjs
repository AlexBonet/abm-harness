import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyFailed } from './errors.mjs'
import { sha256, walkFiles } from './fsutil.mjs'
import { render } from './render.mjs'
import { PACKS_FILE, inPacks } from './packs.mjs'
import { PROFILES_FILE, inProfile } from './profiles.mjs'

export const HARNESS_DIR = fileURLToPath(new URL('../harness/', import.meta.url))

const VERSION_FILE = path.join(HARNESS_DIR, 'VERSION')

export function harnessVersion() {
  if (!fs.existsSync(VERSION_FILE)) throw applyFailed('harness/ is missing; run scripts/sync.mjs first')
  return fs.readFileSync(VERSION_FILE, 'utf8').trim()
}

export const renderText = (text, lang) => {
  const installed = render(text, 'install')
  return lang === 'en' ? installed.replaceAll('Resumen', 'Summary').replaceAll('En corto', 'In short') : installed
}

export const renderHarnessFile = (rel, lang) =>
  Buffer.from(renderText(fs.readFileSync(path.join(HARNESS_DIR, rel), 'utf8'), lang))

export function harnessFiles(lang, profile = 'universal', packs = []) {
  return walkFiles(HARNESS_DIR)
    .filter((rel) => rel !== 'VERSION' && rel !== PROFILES_FILE && rel !== PACKS_FILE && !rel.startsWith('project/') && !rel.startsWith('ci/') && inProfile(profile, rel) && inPacks(rel, packs))
    .map((rel) => {
      const executable = (fs.statSync(path.join(HARNESS_DIR, rel)).mode & 0o111) !== 0
      return { rel, sha: sha256(renderHarnessFile(rel, lang)), mode: executable ? 0o755 : 0o644 }
    })
}

export const listHarnessDir = (sub) => fs.readdirSync(path.join(HARNESS_DIR, sub)).sort()

const LANG_SUFFIX = /\.(es|en)(\.[^.]+)$/

export function projectFiles(lang, docsDir) {
  const base = path.join(HARNESS_DIR, 'project')
  if (!fs.existsSync(base)) return []
  return walkFiles(base)
    .filter((rel) => rel.match(LANG_SUFFIX)?.[1] === lang)
    .map((rel) => ({
      rel: `project/${rel}`,
      target: `${docsDir}/${rel.replace(LANG_SUFFIX, '$2')}`,
      sha: sha256(renderHarnessFile(`project/${rel}`, lang)),
    }))
}
