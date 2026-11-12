import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { selectPacks } from '../src/packs.mjs'
import { detectData, detectInterface, detectStacks } from '../src/stacks.mjs'
import { abmh, exists, install, makeRepo, manifestOf, planId, read, removeAll } from './helpers.mjs'

const HARNESS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../harness')
const catalog = () => JSON.parse(fs.readFileSync(path.join(HARNESS, 'packs.json'), 'utf8')).packs
const SHARED = ['checks/check.sh', 'checks/lib.sh']

const sourceFiles = (sub) =>
  fs.existsSync(path.join(HARNESS, sub))
    ? fs.readdirSync(path.join(HARNESS, sub), { recursive: true }).filter((rel) => fs.statSync(path.join(HARNESS, sub, rel)).isFile()).map((rel) => `${sub}/${rel}`)
    : []

test('every file a pack lists exists and every pack or check file belongs to exactly one pack', () => {
  const listed = Object.values(catalog()).flatMap((pack) => pack.files)
  for (const rel of listed) assert.ok(fs.existsSync(path.join(HARNESS, rel)), rel)
  assert.equal(new Set(listed).size, listed.length)
  const onDisk = [...sourceFiles('packs'), ...sourceFiles('checks')].filter((rel) => !SHARED.includes(rel))
  assert.deepEqual(onDisk.sort(), [...listed].sort())
})

test('stacks are detected from marker files with the reason', () => {
  const kotlin = detectStacks(makeRepo({ 'build.gradle.kts': '' }))
  assert.deepEqual(kotlin.map((item) => item.pack), ['code-kotlin'])
  assert.match(kotlin[0].reason, /build\.gradle\.kts/)
  assert.deepEqual(detectStacks(makeRepo({ 'app/src/main/Main.kt': '' })).map((item) => item.pack), ['code-kotlin'])
  assert.deepEqual(detectStacks(makeRepo({ 'astro.config.mjs': '' })).map((item) => item.pack), ['code-astro-react'])
  assert.deepEqual(detectStacks(makeRepo({ 'package.json': '{"dependencies":{"react":"1"}}' })).map((item) => item.pack), ['code-astro-react'])
  assert.deepEqual(detectStacks(makeRepo({ 'README.md': 'x' })), [])
})

test('init proposes the detected stack and installs only its pack', () => {
  const dir = makeRepo({ 'build.gradle.kts': '' })
  const plan = abmh(dir, ['init'])
  assert.match(plan.out, /\[packs\]/)
  assert.match(plan.out, /code-kotlin - detected build\.gradle\.kts/)
  assert.equal(install(dir).code, 0)
  assert.match(read(dir, '.abmh/harness.yaml'), /packs: code,comms,code-kotlin,security,deploy\n$/)
  assert.deepEqual(manifestOf(dir).options.packs, ['code', 'comms', 'code-kotlin', 'security', 'deploy'])
  assert.equal(exists(dir, '.abmh/packs/code-kotlin.md'), true)
  assert.equal(exists(dir, '.abmh/packs/code.md'), true)
  assert.equal(exists(dir, '.abmh/packs/code-astro-react.md'), false)
  assert.equal(exists(dir, '.abmh/packs.json'), false)
})

test('without a detectable stack only the base packs go in and the project is marked pending', () => {
  const dir = makeRepo({ 'README.md': 'x' })
  assert.match(abmh(dir, ['init']).out, /no stack detected/)
  assert.equal(install(dir).code, 0)
  assert.match(read(dir, '.abmh/harness.yaml'), /packs: code,comms,security,deploy\nstack: pending\n$/)
  assert.equal(exists(dir, '.abmh/packs/code-kotlin.md'), false)
})

test('update --packs completes a pending project and then reports nothing to do', () => {
  const dir = makeRepo({ 'README.md': 'x' })
  install(dir)
  const plan = abmh(dir, ['update', '--packs', 'code-astro-react'])
  assert.match(plan.out, /--packs code-astro-react/)
  assert.equal(abmh(dir, ['update', '--packs', 'code-astro-react', '--accept-plan', planId(plan.out)]).code, 0)
  assert.equal(exists(dir, '.abmh/packs/code-astro-react.md'), true)
  assert.doesNotMatch(read(dir, '.abmh/harness.yaml'), /stack: pending/)
  assert.match(read(dir, '.abmh/harness.yaml'), /packs: code,comms,code-astro-react,security,deploy\n$/)
  assert.match(abmh(dir, ['update']).out, /already up to date/)
})

test('--packs on init adds a stack the detection did not find', () => {
  const dir = makeRepo({ 'build.gradle.kts': '' })
  assert.equal(install(dir, ['--packs', 'code-astro-react']).code, 0)
  assert.deepEqual(manifestOf(dir).options.packs, ['code', 'comms', 'code-kotlin', 'code-astro-react', 'security', 'deploy'])
})

test('an unknown pack, a non-stack pack and --packs on remove or migrate are usage errors', () => {
  const dir = makeRepo()
  const unknown = abmh(dir, ['init', '--packs', 'nope'])
  assert.equal(unknown.code, 2)
  assert.match(unknown.err, /unknown pack nope\. Valid: code-kotlin, code-astro-react, data/)
  assert.equal(abmh(dir, ['init', '--packs', 'code']).code, 2)
  assert.equal(abmh(dir, ['remove', '--packs', 'code-kotlin']).code, 2)
  assert.equal(abmh(dir, ['migrate', '--packs', 'code-kotlin']).code, 2)
})

test('the strict profile adds the pnpm pack and universal does not', () => {
  const strict = makeRepo()
  install(strict, ['--profile', 'abm-estricto'])
  assert.equal(exists(strict, '.abmh/packs/code-pnpm.md'), true)
  assert.deepEqual(manifestOf(strict).options.packs.slice(0, 3), ['code', 'comms', 'code-pnpm'])
  const universal = makeRepo()
  install(universal)
  assert.equal(exists(universal, '.abmh/packs/code-pnpm.md'), false)
})

test('update keeps an edited pack and remove deletes only what is unedited', () => {
  const dir = makeRepo({ 'build.gradle.kts': '' })
  install(dir)
  fs.appendFileSync(path.join(dir, '.abmh/packs/code-kotlin.md'), 'mine\n')
  assert.match(abmh(dir, ['update']).out, /code-kotlin\.md - edited by hand, kept/)
  assert.equal(removeAll(dir).code, 0)
  assert.equal(exists(dir, '.abmh/packs/code-kotlin.md'), true)
  assert.equal(exists(dir, '.abmh/packs/code.md'), false)
})

const ids = (text) => [...text.matchAll(/^\| ([A-Z]+-\d+) \|/gm)].map((match) => match[1])

test('every pack row names an existing check and the Prueba and Seguridad gates list exactly their ids', () => {
  const rows = Object.entries(catalog()).flatMap(([pack, spec]) => spec.files.filter((rel) => rel.startsWith('packs/')).flatMap((rel) => [...fs.readFileSync(path.join(HARNESS, rel), 'utf8').matchAll(/^\| ([A-Z]+-\d+) \| .* \| ([a-z0-9-]+\.sh) \| (script|hook) \| (\S+) \|$/gm)].map((m) => ({ pack, id: m[1], script: m[2], gate: m[4] }))))
  assert.ok(rows.length >= 32)
  for (const row of rows) assert.ok(catalog()[row.pack].files.includes(`checks/${row.script}`), `${row.id} -> ${row.script}`)
  for (const [file, name] of [['gates/test.md', 'Prueba'], ['gates/security.md', 'Seguridad'], ['gates/release.md', 'Despliegue'], ['gates/design.md', 'Diseño'], ['gates/seo.md', 'SEO']]) {
    const gate = fs.readFileSync(path.join(HARNESS, file), 'utf8')
    const listed = gate.match(/^- Rules: (.*?)\./m)[1].split(', ')
    const universal = rows.filter((row) => row.gate === name && catalog()[row.pack].kind !== 'profile').map((row) => row.id)
    assert.deepEqual(listed.sort(), universal.sort(), name)
  }
  assert.deepEqual(ids(fs.readFileSync(path.join(HARNESS, 'packs/data.md'), 'utf8')), ['MIG-01', 'MIG-02', 'MIG-03', 'MIG-04'])
  assert.deepEqual(ids(fs.readFileSync(path.join(HARNESS, 'packs/security.md'), 'utf8')), ['SEC-01', 'SEC-02', 'SEC-03'])
  assert.match(fs.readFileSync(path.join(HARNESS, 'gates/security.md'), 'utf8'), /check\.sh seguridad/)
  for (const [file, command] of [['release', 'despliegue'], ['design', 'diseño'], ['seo', 'seo']]) assert.match(fs.readFileSync(path.join(HARNESS, `gates/${file}.md`), 'utf8'), new RegExp(`check\\.sh ${command}`))
  assert.deepEqual(ids(fs.readFileSync(path.join(HARNESS, 'packs/deploy.md'), 'utf8')), ['DEP-01', 'DEP-02', 'DEP-03', 'DEP-04'])
  assert.deepEqual(ids(fs.readFileSync(path.join(HARNESS, 'packs/design.md'), 'utf8')), ['DSN-01', 'DSN-02'])
  assert.deepEqual(ids(fs.readFileSync(path.join(HARNESS, 'packs/seo.md'), 'utf8')), ['SEO-01', 'SEO-02', 'SEO-03', 'SEO-04', 'SEO-05', 'SEO-06', 'SEO-07'])
  assert.match(fs.readFileSync(path.join(HARNESS, 'strict.md'), 'utf8'), /COD-09/)
  assert.deepEqual(ids(fs.readFileSync(path.join(HARNESS, 'packs/code-pnpm.md'), 'utf8')), ['COD-09'])
})

test('the baseline and the verify template point to the checks', () => {
  assert.match(fs.readFileSync(path.join(HARNESS, 'core/AGENT_BASELINE.md'), 'utf8'), /\{\{ABMH\}\}checks\/check\.sh prueba/)
  assert.match(fs.readFileSync(path.join(HARNESS, 'core/templates/verify-template.sh.md'), 'utf8'), /check\.sh prueba/)
})

test('migration folders are detected only when they hold a .sql file', () => {
  const found = detectData(makeRepo({ 'supabase/migrations/001_a.sql': 'select 1;' }))
  assert.deepEqual(found, [{ pack: 'data', reason: 'detected supabase/migrations' }])
  assert.deepEqual(detectData(makeRepo({ 'db/migrations/001_a.sql': '' })).map((item) => item.reason), ['detected db/migrations'])
  assert.deepEqual(detectData(makeRepo({ 'migrations/README.md': 'x' })), [])
  assert.deepEqual(detectData(makeRepo({ 'README.md': 'x' })), [])
})

test('init installs data on detection, --packs data asks for it and update never detects', () => {
  const detected = makeRepo({ 'supabase/migrations/001_a.sql': '' })
  assert.match(abmh(detected, ['init']).out, /data - detected supabase\/migrations/)
  install(detected)
  assert.deepEqual(manifestOf(detected).options.packs, ['code', 'comms', 'data', 'security', 'deploy'])
  assert.equal(exists(detected, '.abmh/packs/data.md'), true)
  const plain = makeRepo({ 'README.md': 'x' })
  install(plain)
  assert.equal(exists(plain, '.abmh/packs/data.md'), false)
  fs.mkdirSync(path.join(plain, 'migrations'))
  fs.writeFileSync(path.join(plain, 'migrations/001_a.sql'), '')
  assert.match(abmh(plain, ['update']).out, /already up to date/)
  const plan = abmh(plain, ['update', '--packs', 'data'])
  assert.equal(abmh(plain, ['update', '--packs', 'data', '--accept-plan', planId(plan.out)]).code, 0)
  assert.equal(exists(plain, '.abmh/packs/data.md'), true)
  assert.match(read(plain, '.abmh/harness.yaml'), /stack: pending/)
})

test('security is always installed and joins an install made before it existed', () => {
  const dir = makeRepo({ 'README.md': 'x' })
  install(dir)
  assert.equal(exists(dir, '.abmh/packs/security.md'), true)
  const older = selectPacks({ profile: 'universal', detected: [], requested: [], stored: ['code', 'comms'] })
  assert.deepEqual(older.ids, ['code', 'comms', 'security', 'deploy'])
})

test('an interface is detected from UI dependencies, an index.html or an Android manifest', () => {
  const dependency = detectInterface(makeRepo({ 'package.json': '{"devDependencies":{"vue":"3"}}' }))
  assert.deepEqual(dependency, [{ pack: 'design', reason: 'detected vue' }])
  assert.deepEqual(detectInterface(makeRepo({ 'public/index.html': '' })).map((item) => item.reason), ['detected public/index.html'])
  assert.deepEqual(detectInterface(makeRepo({ 'index.html': '' })).map((item) => item.reason), ['detected index.html'])
  assert.deepEqual(detectInterface(makeRepo({ 'app/src/main/AndroidManifest.xml': '' })).map((item) => item.reason), ['detected app/src/main/AndroidManifest.xml'])
  assert.deepEqual(detectInterface(makeRepo({ 'package.json': '{"dependencies":{"express":"4"}}' })), [])
  assert.deepEqual(detectInterface(makeRepo({ 'README.md': 'x' })), [])
})

test('init installs design on an interface, --packs asks for design and seo, seo is never chosen alone and deploy is always there', () => {
  const ui = makeRepo({ 'package.json': '{"dependencies":{"react":"1"}}' })
  assert.match(abmh(ui, ['init']).out, /design - detected react/)
  install(ui)
  assert.deepEqual(manifestOf(ui).options.packs, ['code', 'comms', 'code-astro-react', 'security', 'deploy', 'design'])
  assert.equal(exists(ui, '.abmh/packs/design.md'), true)
  assert.equal(exists(ui, '.abmh/packs/seo.md'), false)
  const plain = makeRepo({ 'README.md': 'x' })
  install(plain)
  assert.equal(exists(plain, '.abmh/packs/deploy.md'), true)
  assert.equal(exists(plain, '.abmh/packs/design.md'), false)
  const asked = makeRepo({ 'README.md': 'x' })
  assert.equal(install(asked, ['--packs', 'design,seo']).code, 0)
  assert.deepEqual(manifestOf(asked).options.packs, ['code', 'comms', 'security', 'deploy', 'design', 'seo'])
  assert.equal(exists(asked, '.abmh/packs/seo.md'), true)
})

test('update joins deploy to an older install and design or seo only when asked', () => {
  const older = selectPacks({ profile: 'universal', detected: [], requested: [], stored: ['code', 'comms', 'security'] })
  assert.deepEqual(older.ids, ['code', 'comms', 'security', 'deploy'])
  const dir = makeRepo({ 'README.md': 'x' })
  install(dir)
  fs.writeFileSync(path.join(dir, 'index.html'), '')
  assert.match(abmh(dir, ['update']).out, /already up to date/)
  const plan = abmh(dir, ['update', '--packs', 'seo'])
  assert.equal(abmh(dir, ['update', '--packs', 'seo', '--accept-plan', planId(plan.out)]).code, 0)
  assert.equal(exists(dir, '.abmh/packs/seo.md'), true)
  assert.equal(exists(dir, '.abmh/packs/design.md'), false)
})
