import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { abmh, install, makeRepo, read, snapshot } from './helpers.mjs'

const git = (dir, ...args) => execFileSync('git', ['-c', 'user.email=t@t.test', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const put = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
  fs.writeFileSync(path.join(dir, rel), text)
}
const commit = (dir) => {
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'x')
}

const fillDocs = (dir) => {
  put(dir, '00-docs/RELEASE.md', 'Touches: the docs\nCould break: nothing\nRollback: revert\nPost-check: read them\n')
  put(dir, '00-docs/RECOVERY.md', 'Contain: stop the deploy\nCheck health: open the page\nRestore: revert the commit\n')
}

const clean = () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir, ['--ci', '--packs', 'code-kotlin'])
  fillDocs(dir)
  fs.appendFileSync(path.join(dir, '.abmh/harness.yaml'), 'web: true\nstaging: https://staging.example.test\n')
  commit(dir)
  return dir
}

const fresh = () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir)
  return dir
}

const doctor = (dir, extra = []) => abmh(dir, ['doctor', ...extra])
const line = (out, id) => out.split('\n').find((text) => new RegExp(`^(OK|FAIL|NOT RUN) +${id} `).test(text))

test('a clean install reports OK on every item and exits 0', () => {
  const result = doctor(clean())
  assert.equal(result.code, 0, result.out)
  for (const id of ['D1', 'D2', 'D3', 'D4', 'D5']) assert.match(line(result.out, id), /^OK /)
  assert.doesNotMatch(result.out, /^(FAIL|NOT RUN)/m)
})

test('doctor without an install fails D1 and says to run init', () => {
  const dir = makeRepo({ 'README.md': 'x\n' })
  const result = doctor(dir)
  assert.equal(result.code, 1)
  assert.match(result.out, /^FAIL +D1 /m)
  assert.match(result.out, /abmh init/)
})

test('doctor reports a stale harness version and says to update', () => {
  const dir = clean()
  const file = path.join(dir, '.abmh/manifest.json')
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  fs.writeFileSync(file, JSON.stringify({ ...manifest, harnessVersion: 'old' }))
  const result = doctor(dir)
  assert.equal(result.code, 1)
  assert.match(line(result.out, 'D1'), /^FAIL /)
  assert.match(result.out, /abmh update/)
})

test('doctor lists files edited by hand, lost files and an edited block, but not harness.yaml', () => {
  const dir = clean()
  fs.appendFileSync(path.join(dir, '.abmh/lanes/consult.md'), 'mine\n')
  const files = fs.readdirSync(path.join(dir, '.abmh/gates'))
  fs.rmSync(path.join(dir, '.abmh/gates', files[0]))
  put(dir, 'AGENTS.md', read(dir, 'AGENTS.md').replace('ABMH harness', 'My harness'))
  const result = doctor(dir)
  assert.equal(result.code, 1)
  assert.match(line(result.out, 'D2'), /^FAIL /)
  assert.match(result.out, /\.abmh\/lanes\/consult\.md/)
  assert.match(result.out, new RegExp(`\\.abmh/gates/${files[0]}`))
  assert.match(result.out, /AGENTS\.md/)
  assert.doesNotMatch(result.out, /harness\.yaml: /)
})

test('doctor reports a lost hook with the command that restores it', () => {
  const dir = clean()
  git(dir, 'config', '--unset', 'core.hooksPath')
  const result = doctor(dir)
  assert.match(line(result.out, 'D3'), /^FAIL /)
  assert.match(result.out, /git config core\.hooksPath \.abmh\/hooks/)
})

test('doctor says NOT RUN for the hook when husky owns the hooks and names the CI', () => {
  const dir = makeRepo({ '.husky/pre-commit': 'x\n' })
  install(dir)
  const result = doctor(dir)
  assert.match(line(result.out, 'D3'), /^NOT RUN /)
  assert.match(result.out, /CI/)
})

test('doctor reports a missing docs file and a packs line that disagrees with the install', () => {
  const dir = clean()
  fs.rmSync(path.join(dir, '00-docs/STATUS.md'))
  const yaml = read(dir, '.abmh/harness.yaml').replace(/^packs: .*$/m, 'packs: code')
  put(dir, '.abmh/harness.yaml', yaml)
  const result = doctor(dir)
  assert.match(line(result.out, 'D5'), /^FAIL /)
  assert.match(result.out, /STATUS\.md/)
  assert.match(line(result.out, 'D4'), /^FAIL /)
  assert.match(result.out, /abmh update --packs/)
})

test('doctor says NOT RUN for packs while the stack is pending', () => {
  const result = doctor(fresh())
  assert.match(line(result.out, 'D4'), /^NOT RUN /)
  assert.match(result.out, /update --packs/)
})

test('doctor shows the unfilled RELEASE and RECOVERY rules as FAIL with the fix', () => {
  const result = doctor(fresh())
  assert.match(result.out, /^FAIL +DEP-02 /m)
  assert.match(result.out, /^FAIL +DEP-03 /m)
  assert.match(result.out, /RELEASE\.md/)
  assert.match(result.out, /fix:/)
})

test('doctor never reports OK for a rule that could not run', () => {
  const dir = fresh()
  const result = doctor(dir)
  assert.match(result.out, /^NOT RUN +SEC-03 /m)
  assert.doesNotMatch(result.out, /^OK +SEC-03 /m)
})

test('exit codes: 1 when anything fails, 2 when only NOT RUN is left, 0 when all is OK', () => {
  const dir = clean()
  assert.equal(doctor(dir).code, 0)
  const nocommits = clean()
  fs.rmSync(path.join(nocommits, '.git/HEAD'))
  fs.writeFileSync(path.join(nocommits, '.git/HEAD'), 'ref: refs/heads/none\n')
  const result = doctor(nocommits)
  assert.equal(result.code, 2, result.out)
  assert.doesNotMatch(result.out, /^FAIL/m)
})

test('doctor writes nothing: tree and git config are the same before and after', () => {
  for (const make of [fresh, clean, () => makeRepo({ 'a.txt': 'x\n' })]) {
    const dir = make()
    const before = snapshot(dir)
    doctor(dir)
    assert.deepEqual(snapshot(dir), before)
  }
})

test('doctor takes no plan flags and honours --root', () => {
  const dir = clean()
  assert.equal(doctor(dir, ['--accept-plan', 'abc']).code, 2)
  assert.match(doctor(dir, ['--accept-plan', 'abc']).err, /does not apply to doctor/)
  const outside = makeRepo({ 'x.txt': 'x\n' })
  assert.equal(abmh(outside, ['doctor', '--root', dir]).code, 0)
})

test('doctor reports an unreadable manifest as D1 FAIL with exit 1, not as a crash', () => {
  const dir = clean()
  fs.writeFileSync(path.join(dir, '.abmh/manifest.json'), '{ "schema": 1, "entr')
  const result = doctor(dir)
  assert.equal(result.code, 1)
  assert.match(result.out, /^FAIL +D1 /m)
  assert.match(result.out, /unreadable/)
  assert.match(result.out, /fix:/)
})

test('doctor reports a skill link that points elsewhere or nowhere', () => {
  const dir = clean()
  const link = path.join(dir, '.claude/skills/spec')
  fs.rmSync(link)
  fs.symlinkSync('/nonexistent-target', link)
  const result = doctor(dir)
  assert.match(line(result.out, 'D2'), /^FAIL /)
  assert.match(result.out, /\.claude\/skills\/spec: link points somewhere else/)
  fs.rmSync(link)
  fs.symlinkSync(path.relative(path.dirname(link), path.join(dir, '.abmh/skills/spec')), link)
  assert.match(line(doctor(dir).out, 'D2'), /^OK /)
})
