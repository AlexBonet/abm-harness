import fs from 'node:fs'
import path from 'node:path'

const SKIPPED = new Set(['node_modules', '.git', 'build', 'dist', '.gradle', '.abmh'])
const MAX_DEPTH = 4
const ASTRO_CONFIGS = ['astro.config.mjs', 'astro.config.ts', 'astro.config.js', 'astro.config.cjs']
const MIGRATION_DIRS = ['supabase/migrations', 'migrations', 'db/migrations']
const UI_DEPENDENCIES = ['astro', 'react', 'vue', 'svelte', 'next', 'solid-js']
const KOTLIN_MARKERS = ['build.gradle.kts', 'settings.gradle.kts']

const present = (root, names) => names.find((name) => fs.existsSync(path.join(root, name)))

function firstKotlinFile(dir, root, depth) {
  if (depth > MAX_DEPTH) return null
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name)
    if (entry.isFile() && entry.name.endsWith('.kt')) return path.relative(root, full)
    if (entry.isDirectory() && !SKIPPED.has(entry.name)) {
      const found = firstKotlinFile(full, root, depth + 1)
      if (found) return found
    }
  }
  return null
}

function packageDependencies(root) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    return { ...parsed.dependencies, ...parsed.devDependencies }
  } catch {
    return {}
  }
}

export function detectStacks(root) {
  const found = []
  const kotlin = present(root, KOTLIN_MARKERS) ?? firstKotlinFile(root, root, 0)
  if (kotlin) found.push({ pack: 'code-kotlin', reason: `detected ${kotlin}` })
  const dependencies = packageDependencies(root)
  const astro = present(root, ASTRO_CONFIGS) ?? ['astro', 'react'].find((name) => name in dependencies)
  if (astro) found.push({ pack: 'code-astro-react', reason: `detected ${astro}` })
  return found
}

const holdsSql = (dir) => {
  try {
    return fs.readdirSync(dir).some((name) => name.endsWith('.sql'))
  } catch {
    return false
  }
}

export function detectData(root) {
  const folder = MIGRATION_DIRS.find((name) => holdsSql(path.join(root, name)))
  return folder ? [{ pack: 'data', reason: `detected ${folder}` }] : []
}

function firstManifest(dir, root, depth) {
  if (depth > MAX_DEPTH) return null
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name)
    if (entry.isFile() && entry.name === 'AndroidManifest.xml') return path.relative(root, full)
    if (entry.isDirectory() && !SKIPPED.has(entry.name)) {
      const found = firstManifest(full, root, depth + 1)
      if (found) return found
    }
  }
  return null
}

export function detectInterface(root) {
  const dependencies = packageDependencies(root)
  const found = UI_DEPENDENCIES.find((name) => name in dependencies) ?? present(root, ['index.html', 'public/index.html']) ?? firstManifest(root, root, 0)
  return found ? [{ pack: 'design', reason: `detected ${found}` }] : []
}
