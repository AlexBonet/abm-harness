import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SYNC = path.join(ROOT, 'scripts/sync.mjs')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

test('sync --check reports NOT RUN, never OK, when there is no ABMS root', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-noroot-'))
  const result = spawnSync('node', [SYNC, '--check', '--root', empty], { encoding: 'utf8' })
  assert.equal(result.status, 3)
  assert.match(result.stderr, /NOT RUN/)
  assert.doesNotMatch(result.stdout, /matches/)
})

test('sync --check still fails on a root that drifted', () => {
  const drifted = fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-drift-'))
  fs.mkdirSync(path.join(drifted, '_system'))
  fs.writeFileSync(path.join(drifted, '_system/AGENT_BASELINE.md'), 'x')
  const result = spawnSync('node', [SYNC, '--check', '--root', drifted], { encoding: 'utf8' })
  assert.equal(result.status, 1)
})

test('verify.sh keeps going on NOT RUN of sync --check and says so', () => {
  const text = read('scripts/verify.sh')
  assert.match(text, /sync\.mjs --check/)
  assert.match(text, /NOT RUN/)
})

for (const file of ['AGENTS.md', 'README.md', 'README.en.md']) {
  test(`${file} does not point outside the repo`, () => {
    assert.doesNotMatch(read(file), /\.\.\/|_docs\/|_system\//)
  })
}

test('AGENTS.md points to the baseline that ships in this repo', () => {
  const text = read('AGENTS.md')
  assert.match(text, /harness\/core\/AGENT_BASELINE\.md/)
  assert.ok(fs.existsSync(path.join(ROOT, 'harness/core/AGENT_BASELINE.md')))
})

const PREPUBLISH = path.join(ROOT, 'scripts/prepublish.sh')
const gitIn = (dir, ...args) => execFileSync('git', ['-c', 'user.email=dev@example.test', '-c', 'user.name=dev', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const commitAll = (dir, message = 'x', author = null) => {
  gitIn(dir, 'add', '-A')
  gitIn(dir, ...(author ? ['-c', `user.email=${author}`] : []), 'commit', '-q', '-m', message)
}
const unusedNames = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-names-')), 'names.txt')
fs.writeFileSync(unusedNames, 'zzzunusedname\n')
const prepublish = (dir, extra = []) => {
  const flags = [...(extra.includes('--email') ? [] : ['--email', 'users.noreply.github.com']), ...(extra.includes('--deny-file') ? [] : ['--deny-file', unusedNames])]
  const result = spawnSync('sh', [PREPUBLISH, dir, ...flags, ...extra], { encoding: 'utf8' })
  return { code: result.status, out: `${result.stdout}${result.stderr}` }
}
const publishRepo = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-pub-'))
  gitIn(dir, 'init', '-q')
  fs.cpSync(path.join(ROOT, 'harness/checks'), path.join(dir, 'harness/checks'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'README.md'), 'hello\n')
  commitAll(dir, 'first', 'noreply@users.noreply.github.com')
  return dir
}
const addAndRemove = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
  fs.writeFileSync(path.join(dir, rel), text)
  commitAll(dir, 'add', 'noreply@users.noreply.github.com')
  fs.rmSync(path.join(dir, rel))
  commitAll(dir, 'remove', 'noreply@users.noreply.github.com')
}
const HOME_PATH = ['/Use', 'rs/', 'someone/project'].join('')

test('prepublish passes a clean repo and names every check', () => {
  const result = prepublish(publishRepo())
  assert.equal(result.code, 0, result.out)
  for (const name of ['secrets in the tree', 'secrets in the history', 'personal paths', 'author emails', 'private names', 'big files', 'env files']) assert.match(result.out, new RegExp(`PASS ${name}`))
})

test('prepublish finds a personal path that was committed and deleted, naming commit and file only', () => {
  const dir = publishRepo()
  addAndRemove(dir, 'notes/a.txt', `see ${HOME_PATH}\n`)
  const result = prepublish(dir)
  assert.equal(result.code, 1)
  assert.match(result.out, /FAIL personal paths/)
  assert.match(result.out, /[0-9a-f]{7,}:notes\/a\.txt/)
  assert.ok(!result.out.includes('someone'))
})

test('prepublish finds a key in the history and a committed env file', () => {
  const dir = publishRepo()
  addAndRemove(dir, 'k.txt', `${['AKI', 'A'].join('')}ABCDEFGH12345678\n`)
  addAndRemove(dir, '.env', 'A=1\n')
  const result = prepublish(dir)
  assert.equal(result.code, 1)
  assert.match(result.out, /FAIL secrets in the history/)
  assert.match(result.out, /FAIL env files/)
})

test('prepublish lists author emails that are not the allowed domain', () => {
  const dir = publishRepo()
  fs.writeFileSync(path.join(dir, 'b.txt'), 'b\n')
  commitAll(dir, 'second', 'real.person@example.test')
  const result = prepublish(dir)
  assert.equal(result.code, 1)
  assert.match(result.out, /FAIL author emails/)
  assert.match(result.out, /real\.person@example\.test/)
  assert.equal(prepublish(dir, ['--email', 'example.test']).code, 1)
  assert.equal(spawnSync('sh', [PREPUBLISH, dir, '--deny-file', unusedNames], { encoding: 'utf8' }).status, 2)
})

test('prepublish reads private names from a file outside the repo', () => {
  const dir = publishRepo()
  fs.writeFileSync(path.join(dir, 'a.txt'), 'built for Privateproj\n')
  commitAll(dir, 'x', 'noreply@users.noreply.github.com')
  const deny = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-deny-')), 'names.txt')
  fs.writeFileSync(deny, 'privateproj\n')
  const result = prepublish(dir, ['--deny-file', deny])
  assert.equal(result.code, 1)
  assert.match(result.out, /FAIL private names/)
  assert.equal(prepublish(dir).code, 0)
})

test('prepublish flags a file over one megabyte', () => {
  const dir = publishRepo()
  fs.writeFileSync(path.join(dir, 'big.bin'), Buffer.alloc(1100000, 1))
  commitAll(dir)
  assert.match(prepublish(dir).out, /FAIL big files/)
})

test('prepublish is NOT RUN on a shallow clone and outside git', () => {
  const origin = publishRepo()
  const shallow = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-sh-')), 'c')
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${origin}`, shallow])
  assert.equal(prepublish(shallow).code, 2)
  assert.equal(prepublish(fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-nogit-'))).code, 2)
})

test('prepublish.sh stays small and has no private literals', () => {
  const text = read('scripts/prepublish.sh')
  assert.ok(text.split('\n').length <= 100)
  assert.doesNotMatch(text, new RegExp(['000-ABM', 'S|/Use', 'rs/'].join('')))
})

test('the repo has its own CI that verifies and scans the whole history', () => {
  const text = read('.github/workflows/ci.yml')
  assert.match(text, /fetch-depth: 0/)
  assert.match(text, /sh scripts\/verify\.sh/)
  assert.match(text, /sec-01\.sh/)
  assert.match(text, /sec-03\.sh/)
})

const everyHarnessFile = () => fs.readdirSync(path.join(ROOT, 'harness'), { recursive: true }).map((rel) => path.join('harness', rel)).filter((rel) => fs.statSync(path.join(ROOT, rel)).isFile())

test('LICENSE, NOTICES.md and package.json agree on MIT', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.license, 'MIT')
  assert.match(read('LICENSE'), /^MIT License\n\nCopyright \(c\) 2026 Alex Bonet\n/)
  assert.match(read('NOTICES.md'), /MIT/)
  assert.ok(pkg.files.includes('LICENSE') && pkg.files.includes('NOTICES.md'))
  assert.equal(pkg.private, true)
})

test('every harness file that names a third party is listed in NOTICES.md with its licence', () => {
  const notices = read('NOTICES.md')
  const named = everyHarnessFile().filter((rel) => /Pocock/.test(read(rel)))
  assert.ok(named.length >= 4)
  for (const rel of named) assert.ok(notices.includes(rel), rel)
  assert.match(notices, /Copyright \(c\) 2026 Matt Pocock/)
})

for (const file of ['README.md', 'README.en.md']) {
  test(`${file}: the first screen shows install, update, remove and doctor pinned to the package version`, () => {
    const first = read(file).split('\n').slice(0, 25).join('\n')
    const tag = `github:AlexBonet/abm-harness#v${JSON.parse(read('package.json')).version}`
    for (const command of ['init', 'update', 'doctor', 'remove']) assert.ok(first.includes(`pnpm dlx ${tag} ${command}`), `${file} ${command}`)
  })
}

test('prepublish finds a personal path on a line that starts with a tab', () => {
  const dir = publishRepo()
  addAndRemove(dir, 'notes/t.txt', `\t${HOME_PATH}\n`)
  assert.match(prepublish(dir).out, /FAIL personal paths[\s\S]*notes\/t\.txt/)
})

test('prepublish checks the domain boundary of the allowed email', () => {
  const dir = publishRepo()
  fs.writeFileSync(path.join(dir, 'b.txt'), 'b\n')
  commitAll(dir, 'second', 'someone@evil-example.test')
  const result = prepublish(dir, ['--email', 'example.test'])
  assert.match(result.out, /FAIL author emails[\s\S]*someone@evil-example\.test/)
})

test('prepublish finds a private name in an uncommitted file and a big file deleted long ago', () => {
  const dir = publishRepo()
  fs.writeFileSync(path.join(dir, 'new.txt'), 'for Privateproj\n')
  const deny = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-deny-')), 'names.txt')
  fs.writeFileSync(deny, 'privateproj\n')
  assert.match(prepublish(dir, ['--deny-file', deny]).out, /FAIL private names[\s\S]*tree:new\.txt/)
  const big = publishRepo()
  addAndRemove(big, 'old.bin', Buffer.alloc(1100000, 2).toString('latin1'))
  assert.match(prepublish(big).out, /FAIL big files[\s\S]*old\.bin/)
  fs.writeFileSync(path.join(big, 'loose.bin'), Buffer.alloc(1100000, 3))
  assert.match(prepublish(big).out, /loose\.bin: over 1 MB/)
})

test('prepublish finds an env file under a path git has to quote', () => {
  const dir = publishRepo()
  addAndRemove(dir, 'dir\nname/.env', 'A=1\n')
  assert.match(prepublish(dir).out, /FAIL env files/)
})
