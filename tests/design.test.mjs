import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { project, sh, write } from './checkhelpers.mjs'
import { install, makeRepo } from './helpers.mjs'

const dsn = (files = {}, yaml = '') => {
  const dir = project({ files })
  write(dir, '.abmh/harness.yaml', `version: x\nprofile: universal\ndocsDir: 00-docs\n${yaml}`)
  return dir
}

test('DSN-01 passes with DESIGN.md or design-tokens.md at the root or in the docs folder', () => {
  for (const file of ['DESIGN.md', 'design-tokens.md', '00-docs/DESIGN.md', '00-docs/design-tokens.md']) {
    assert.equal(sh(dsn({ [file]: '# design\n' }), 'dsn-01.sh').code, 0, file)
  }
})

test('DSN-01 fails and says what to create when neither document exists', () => {
  const result = sh(dsn({ 'README.md': 'x' }), 'dsn-01.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /DESIGN\.md or design-tokens\.md/)
})

test('DSN-02 passes when the declared command exits 0 and runs from the project root', () => {
  const dir = dsn({ 'marker.txt': 'x' }, 'design_check: test -f marker.txt\n')
  assert.equal(sh(dir, 'dsn-02.sh').code, 0)
})

test('DSN-02 fails with the last 20 lines of a failing command', () => {
  const lines = 'i=1; while [ $i -le 30 ]; do echo line$i; i=$((i + 1)); done; exit 1'
  const result = sh(dsn({}, `design_check: ${lines}\n`), 'dsn-02.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /line30/)
  assert.match(result.out, /line11/)
  assert.doesNotMatch(result.out, /line10\b/)
})

test('DSN-02 is NOT RUN without a declared command or when the command does not exist', () => {
  const none = sh(dsn(), 'dsn-02.sh')
  assert.equal(none.code, 2)
  assert.match(none.out, /design_check:/)
  const missing = sh(dsn({}, 'design_check: abmh-no-such-tool --contrast\n'), 'dsn-02.sh')
  assert.equal(missing.code, 2)
  assert.match(missing.out, /not found/)
})

test('check.sh diseño and design run the DSN rules from the pack table', () => {
  const dir = dsn({ 'DESIGN.md': '# d\n' }, 'design_check: exit 0\n')
  for (const gate of ['diseño', 'design', 'Diseño']) {
    const result = sh(dir, 'check.sh', [gate])
    assert.equal(result.code, 0, result.out)
    assert.match(result.out, /PASS DSN-01/)
    assert.match(result.out, /PASS DSN-02/)
  }
  write(dir, '.abmh/harness.yaml', 'docsDir: 00-docs\ndesign_check: exit 3\n')
  assert.equal(sh(dir, 'check.sh', ['design']).code, 1)
})

test('an installed interface project gets DSN-01 failing until a design document exists, DSN-02 NOT RUN', () => {
  const dir = makeRepo({ 'package.json': '{"dependencies":{"react":"1"}}' })
  install(dir)
  const result = sh(dir, 'check.sh', ['design'])
  assert.equal(result.code, 1)
  assert.match(result.out, /FAIL DSN-01/)
  assert.match(result.out, /NOT RUN DSN-02/)
})

test('DSN-02 runs a quoted design_check and check.sh knows DISEÑO and diseno', () => {
  assert.equal(sh(dsn({}, 'design_check: "exit 0"\n'), 'dsn-02.sh').code, 0)
  const dir = dsn({ 'DESIGN.md': '# d\n' }, 'design_check: exit 0\n')
  for (const gate of ['DISEÑO', 'diseno']) assert.match(sh(dir, 'check.sh', [gate]).out, /PASS DSN-01/, gate)
})

test('checks read the project from its root even when run from a subfolder', () => {
  const dir = dsn({ 'DESIGN.md': '# d\n', 'sub/x.txt': 'x' }, 'design_check: test -f DESIGN.md\n')
  const result = spawnSync('sh', [path.join(dir, '.abmh/checks/check.sh'), 'design'], { cwd: path.join(dir, 'sub'), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout)
})
