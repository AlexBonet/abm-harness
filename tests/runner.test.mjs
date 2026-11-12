import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { HARNESS, project, sh, write } from './checkhelpers.mjs'

const TABLE = (rows) => `# Pack: t\n\n| id | rule | check | type | gate |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`

function withChecks(rows, scripts) {
  const dir = project()
  for (const name of fs.readdirSync(path.join(dir, '.abmh/packs'))) fs.rmSync(path.join(dir, '.abmh/packs', name))
  write(dir, '.abmh/packs/t.md', TABLE(rows))
  for (const [name, body] of Object.entries(scripts)) write(dir, `.abmh/checks/${name}`, body)
  return dir
}

test('check.sh prints PASS, FAIL and NOT RUN per rule id and exits 1 only on FAIL', () => {
  const dir = withChecks(
    ['| T-01 | first rule | t-01.sh | script | Prueba |', '| T-02 | second rule | t-02.sh | script | Prueba |', '| T-03 | third rule | t-03.sh | script | Prueba |', '| T-04 | other gate | t-04.sh | script | Revision |'],
    { 't-01.sh': 'exit 0\n', 't-02.sh': 'echo a.kt:3 bad\nexit 1\n', 't-03.sh': 'echo no git\nexit 2\n', 't-04.sh': 'exit 1\n' },
  )
  const result = sh(dir, 'check.sh', ['prueba'])
  assert.equal(result.code, 1)
  assert.match(result.out, /PASS T-01 first rule/)
  assert.match(result.out, /FAIL T-02 second rule\n\s+a\.kt:3 bad/)
  assert.match(result.out, /NOT RUN T-03 third rule\n\s+no git/)
  assert.doesNotMatch(result.out, /T-04/)
})

test('check.sh exits 0 when nothing fails, even with NOT RUN rules', () => {
  const dir = withChecks(['| T-01 | r | t-01.sh | script | Prueba |', '| T-02 | r | t-02.sh | script | Prueba |'], { 't-01.sh': 'exit 0\n', 't-02.sh': 'exit 2\n' })
  assert.equal(sh(dir, 'check.sh', ['Prueba']).code, 0)
  assert.equal(sh(dir, 'check.sh', ['test']).code, 0)
})

test('a missing script is NOT RUN and a crashing script is a FAIL called check error', () => {
  const dir = withChecks(['| T-01 | r | t-01.sh | script | Prueba |', '| T-02 | r | t-02.sh | script | Prueba |'], { 't-02.sh': 'exit 7\n' })
  const result = sh(dir, 'check.sh', ['prueba'])
  assert.match(result.out, /NOT RUN T-01 r\n\s+check not installed: t-01\.sh/)
  assert.match(result.out, /FAIL T-02 r\n\s+check error \(exit 7\)/)
  assert.equal(result.code, 1)
})

test('check.sh needs a gate and says when a gate has no rules', () => {
  const dir = withChecks(['| T-01 | r | t-01.sh | script | Prueba |'], { 't-01.sh': 'exit 0\n' })
  assert.equal(sh(dir, 'check.sh').code, 2)
  const none = sh(dir, 'check.sh', ['despliegue'])
  assert.equal(none.code, 0)
  assert.match(none.out, /no rules for gate despliegue/)
})

test('check.sh does not let a check read the list of rules from stdin', () => {
  const dir = withChecks(['| T-01 | r | t-01.sh | script | Prueba |', '| T-02 | r | t-02.sh | script | Prueba |'], { 't-01.sh': 'cat > /dev/null\nexit 0\n', 't-02.sh': 'exit 1\n' })
  assert.match(sh(dir, 'check.sh', ['prueba']).out, /FAIL T-02/)
})

const probe = (name) => `HERE=$(cd "$(dirname "$0")" && pwd)\n. "$HERE/lib.sh"\ncheck_it() { echo "$STACK"; return ${name}; }\neach_stack check_it\nexit $?\n`

test('each_stack runs the check once per installed stack and is NOT RUN when none is installed', () => {
  const none = project()
  write(none, '.abmh/checks/p.sh', probe(0))
  assert.deepEqual([sh(none, 'p.sh').code, /stack pending/.test(sh(none, 'p.sh').out)], [2, true])
  const both = project({ stacks: ['kotlin', 'astro-react'] })
  write(both, '.abmh/checks/p.sh', probe(0))
  const result = sh(both, 'p.sh')
  assert.equal(result.code, 0)
  assert.deepEqual(result.out.trim().split('\n'), ['astro-react', 'kotlin'])
})

test('each_stack fails when any stack fails and is NOT RUN only when all stacks are', () => {
  const dir = project({ stacks: ['kotlin', 'astro-react'] })
  write(dir, '.abmh/checks/p.sh', probe(1))
  assert.equal(sh(dir, 'p.sh').code, 1)
  write(dir, '.abmh/checks/p.sh', probe(2))
  assert.equal(sh(dir, 'p.sh').code, 2)
})

test('cfg reads a key from harness.yaml and falls back to a default', () => {
  const dir = project()
  write(dir, '.abmh/harness.yaml', 'version: x\ndocsDir: notes\n')
  write(dir, '.abmh/checks/p.sh', 'HERE=$(cd "$(dirname "$0")" && pwd)\n. "$HERE/lib.sh"\necho "$(docs_dir) $(cfg_or domain_dir src/domain)"\n')
  assert.equal(sh(dir, 'p.sh').out.trim(), 'notes src/domain')
})

test('src_files lists the stack sources and prunes generated folders', () => {
  const dir = project({ stacks: ['kotlin'], files: { 'a/B.kt': '', 'build/C.kt': '', 'node_modules/D.kt': '', 'a/E.txt': '' } })
  write(dir, '.abmh/checks/p.sh', 'HERE=$(cd "$(dirname "$0")" && pwd)\n. "$HERE/lib.sh"\nlist() { src_files; }\neach_stack list\n')
  assert.equal(sh(dir, 'p.sh').out.trim(), 'a/B.kt')
})

const scripts = () => {
  const found = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.sh')) found.push(full)
    }
  }
  walk(path.join(HARNESS, 'checks'))
  return found
}

test('every check script is portable POSIX sh: parses, no bashisms, no comments, at most 120 lines', () => {
  for (const file of scripts()) {
    const text = fs.readFileSync(file, 'utf8')
    const name = path.relative(HARNESS, file)
    assert.equal(spawnSync('sh', ['-n', file]).status, 0, `${name} does not parse`)
    assert.ok(text.trimEnd().split('\n').length <= 120, `${name} is too long`)
    assert.doesNotMatch(text, /\[\[ |=\(|<\(|echo -e|^\s*#(?!!)/m, `${name} has a bashism or a comment`)
  }
})

test('security is an alias of the Seguridad gate', () => {
  const dir = withChecks(['| T-01 | r | t-01.sh | script | Seguridad |'], { 't-01.sh': 'exit 1\n' })
  assert.equal(sh(dir, 'check.sh', ['seguridad']).code, 1)
  assert.equal(sh(dir, 'check.sh', ['security']).code, 1)
  assert.equal(sh(dir, 'check.sh', ['prueba']).code, 0)
})
