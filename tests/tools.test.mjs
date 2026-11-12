import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, exists, install, makeRepo, planId, read, removeAll, snapshot } from './helpers.mjs'

const FIELDS = {
  en: ['Purpose', 'Route', 'How it was tested', 'Who may write', 'Limits', '.env.example', 'Safe for an agent to run', 'test_connection'],
  es: ['Para qué sirve', 'Vía', 'Cómo se probó', 'Quién puede escribir', 'Límites', '.env.example', 'Seguro para que lo ejecute un agente', 'test_connection'],
}
const INDEX_COLUMNS = { en: ['Connection', 'Account or target', 'Route', 'Mode', 'Last OK'], es: ['Conexión', 'Cuenta o destino', 'Vía', 'Modo', 'Última vez OK'] }
const ELSEWHERE = { en: /documented elsewhere/, es: /documentadas en otro sitio/ }
const PLACEHOLDER = { en: '| <name> |', es: '| <nombre> |' }
const CONTRACT = {
  en: [/only check the identity/, /read-only/, /exit 0 and print/, /exit non-zero and print the reason/, /never print a secret/],
  es: [/solo la identidad/, /solo lectura/, /salir con 0 e imprimir/, /distinto de 0 e imprimir el motivo/, /no imprimir nunca un secreto/],
}
const NAMES = ['KEY', 'TOKEN', 'SECRET']
const ASSIGNMENT = new RegExp(`(${NAMES.join('|')})[A-Z_]*\\s*[:=]\\s*\\S{8,}`, 'i')
const SHAPED = [['s', 'k', '-'], ['gh', 'p_'], ['AK', 'IA'], ['xo', 'xb-'], ['gl', 'pat-'], ['AI', 'za'], ['github', '_pat_'], ['ey', 'J']].map((parts) => parts.join('')).map((prefix) => new RegExp(`\\b${prefix}[A-Za-z0-9_-]{8,}`))
const lines = (text) => text.split('\n').length

for (const lang of ['en', 'es']) {
  test(`init installs the tools index and template unfilled in ${lang}`, () => {
    const dir = makeRepo({ 'README.md': 'x\n' })
    install(dir, ['--lang', lang])
    const index = read(dir, '00-docs/tools/README.md')
    const template = read(dir, '00-docs/tools/TEMPLATE.md')
    for (const text of [index, template]) {
      assert.match(text, /^Audience: both$/m)
      assert.ok(lines(text) <= 60)
    }
    for (const column of INDEX_COLUMNS[lang]) assert.ok(index.includes(column), column)
    assert.match(index, ELSEWHERE[lang])
    assert.ok(index.includes(PLACEHOLDER[lang]))
    assert.match(index, new RegExp(`copy|Copia`, 'i'))
    assert.doesNotMatch(index, /`tools\/<(name|nombre)>/)
    for (const field of FIELDS[lang]) assert.ok(template.includes(field), field)
    assert.match(template, /OK <name> → <identity>/)
    for (const clause of CONTRACT[lang]) assert.match(template, clause)
    assert.deepEqual(fs.readdirSync(path.join(dir, '00-docs/tools')).sort(), ['README.md', 'TEMPLATE.md'])
    for (const text of [index, template]) {
      assert.doesNotMatch(text, ASSIGNMENT)
      for (const shape of SHAPED) assert.doesNotMatch(text, shape)
    }
  })
}

test('the secret scan catches a sample assignment and a sample token shape', () => {
  assert.match(['API', 'TOKEN'].join('_') + '=abcdefgh12', ASSIGNMENT)
  assert.match(['sec', 'ret: ', 'abcdefgh12'].join(''), ASSIGNMENT)
  for (const sample of [['s', 'k', '-'], ['gh', 'p_'], ['AK', 'IA'], ['xo', 'xb-'], ['gl', 'pat-'], ['AI', 'za'], ['github', '_pat_'], ['ey', 'J']]) {
    assert.ok(SHAPED.some((shape) => shape.test(sample.join('') + 'abcdefgh12')), sample.join(''))
  }
})

test('a custom docs folder receives the tools files', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir, ['--docs-dir', 'notes'])
  assert.ok(exists(dir, 'notes/tools/README.md'))
  assert.ok(exists(dir, 'notes/tools/TEMPLATE.md'))
  assert.equal(exists(dir, '00-docs'), false)
})

test('update skips an edited sheet and remove keeps it, both listing it', () => {
  const dir = makeRepo()
  const before = snapshot(dir)
  install(dir)
  fs.appendFileSync(path.join(dir, '00-docs/tools/TEMPLATE.md'), '\nmine\n')
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /skip 00-docs\/tools\/TEMPLATE.md - edited by hand, kept/)
  const removal = abmh(dir, ['remove'])
  assert.match(removal.out, /skip 00-docs\/tools\/TEMPLATE.md - edited by hand, kept/)
  abmh(dir, ['remove', '--accept-plan', planId(removal.out)])
  assert.ok(read(dir, '00-docs/tools/TEMPLATE.md').includes('mine'))
  assert.equal(exists(dir, '00-docs/tools/README.md'), false)
  fs.rmSync(path.join(dir, '00-docs'), { recursive: true })
  assert.deepEqual(snapshot(dir), before)
})

test('other connection sheets under the tools folder survive update and remove', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir)
  fs.mkdirSync(path.join(dir, '00-docs/tools/plane'), { recursive: true })
  fs.writeFileSync(path.join(dir, '00-docs/tools/plane/README.md'), 'plane\n')
  abmh(dir, ['update'])
  removeAll(dir)
  assert.equal(read(dir, '00-docs/tools/plane/README.md'), 'plane\n')
  assert.equal(exists(dir, '00-docs/tools/TEMPLATE.md'), false)
})

const rootTools = (dir) => snapshot(dir).tree.filter((entry) => /(^| )tools\//.test(entry) && !entry.includes('00-docs'))

test('a root tools folder is never moved or changed', () => {
  const dir = makeRepo({ 'tools/plane/README.md': 'plane\n', 'tools/README.md': 'index\n' })
  const root = rootTools(dir)
  assert.ok(root.length >= 2)
  install(dir)
  abmh(dir, ['update'])
  assert.deepEqual(rootTools(dir), root)
  assert.ok(exists(dir, '00-docs/tools/TEMPLATE.md'))
  removeAll(dir)
  assert.deepEqual(rootTools(dir), root)
})

test('a second run has nothing to do', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir)
  assert.match(abmh(dir, ['update']).out, /nothing to do/i)
})

test('the block tells agents to read the sheet first, in AGENTS.md and GEMINI.md only when selected', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir, ['--docs-dir', 'notes'])
  for (const file of ['AGENTS.md', 'GEMINI.md']) {
    const text = read(dir, file)
    assert.match(text, /Before using an external service, read `notes\/tools\/<name>\/README\.md`/)
    assert.match(text, /`test_connection` only if the sheet says it is safe for an agent/)
  }
  const only = makeRepo({ 'README.md': 'x\n' })
  install(only, ['--assistants', 'claude'])
  assert.match(read(only, 'AGENTS.md'), /00-docs\/tools\/<name>\/README\.md/)
  assert.equal(exists(only, 'GEMINI.md'), false)
})

const shaOf = (text) => createHash('sha256').update(text).digest('hex')

test('update refreshes an older block that lacks the tools line', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir)
  const manifest = JSON.parse(read(dir, '.abmh/manifest.json'))
  const stale = read(dir, 'AGENTS.md').replace(/Before using an external service[^\n]*\n/, '')
  assert.ok(!stale.includes('external service'))
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), stale)
  const block = manifest.entries.find((entry) => entry.path === 'AGENTS.md')
  block.sha256 = shaOf(stale.slice(stale.indexOf('<!-- abmh:start -->'), stale.indexOf('<!-- abmh:end -->') + 17))
  fs.writeFileSync(path.join(dir, '.abmh/manifest.json'), JSON.stringify(manifest))
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /update-block AGENTS.md/)
  assert.equal(abmh(dir, ['update', '--accept-plan', planId(plan.out)]).code, 0)
  assert.match(read(dir, 'AGENTS.md'), /Before using an external service/)
})

test('the plan names the tools files and an own tools index is skipped, listed and kept', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  assert.match(abmh(dir, ['init']).out, /create-file 00-docs\/tools\/ \(2 files\) - a place to document connections/)
  install(dir)
  fs.rmSync(path.join(dir, '00-docs/tools/README.md'))
  const manifest = JSON.parse(read(dir, '.abmh/manifest.json'))
  manifest.entries = manifest.entries.filter((entry) => entry.path !== '00-docs/tools/README.md')
  fs.writeFileSync(path.join(dir, '.abmh/manifest.json'), JSON.stringify(manifest))
  fs.writeFileSync(path.join(dir, '00-docs/tools/README.md'), 'mine\n')
  const plan = abmh(dir, ['update'])
  assert.match(plan.out, /skip 00-docs\/tools\/README.md - exists, not installed by abm-harness/)
  abmh(dir, ['update', '--accept-plan', planId(plan.out)])
  assert.equal(read(dir, '00-docs/tools/README.md'), 'mine\n')
})
