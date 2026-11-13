import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { inspectSyntax } from './web-syntax.mjs'

const rule = process.argv[2]
const manifest = process.argv[3]
const docs = process.argv[4]
const requireProject = createRequire(resolve('package.json'))

function generatedPaths() {
  if (!manifest) return []
  return readFileSync(manifest, 'utf8').split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('#')).map((line) => {
    const [path, reason, extra] = line.split('|')
    if (!path || !reason?.trim() || extra !== undefined || path !== path.trim() ||
        path.startsWith('/') || path.includes('\\') || /[*?\[\]]/.test(path) ||
        path.replace(/\/$/, '').split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error(`invalid generated source: ${line}`)
    }
    return path
  })
}

function uiExempt(file, allowlist) {
  return /(\.|\/)(test|spec)\.|(^|\/)(tests?|__tests__)\//.test(file) || allowlist.includes(file)
}

try {
  const generated = generatedPaths()
  const files = readFileSync(0, 'utf8').split('\n').filter(Boolean).filter((file) =>
    !generated.some((path) => path.endsWith('/') ? file.startsWith(path) : file === path))
  let allowlist = []
  if (rule === 'COD-05') {
    try {
      allowlist = readFileSync(resolve(docs, 'ui-allowlist.txt'), 'utf8').split(/\r?\n/)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  const ts = rule === 'COD-02' ? undefined : requireProject('typescript')
  const output = []
  for (const file of files) {
    if (rule === 'COD-05' && uiExempt(file, allowlist)) continue
    const source = readFileSync(file, 'utf8')
    if (rule === 'COD-02') {
      const lines = source === '' ? 0 : source.split('\n').length - Number(source.endsWith('\n'))
      if (lines > 300) output.push(`${file}:${lines} more than 300 lines`)
    } else {
      try {
        output.push(...await inspectSyntax(ts, requireProject, file, source, rule))
      } catch (error) {
        output.push(`${file}: analysis failed: ${error.message}`)
      }
    }
  }
  if (output.length) {
    console.log([...new Set(output)].join('\n'))
    process.exitCode = 1
  }
} catch (error) {
  console.error(`analysis failed: ${error.message}`)
  process.exitCode = 1
}
