import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { project, sh, write } from './checkhelpers.mjs'

const run = (id, files, stacks, extra = []) => {
  const dir = project({ files, stacks })
  for (const [rel, text] of extra) write(dir, rel, text)
  return sh(dir, `${id}.sh`)
}
const lines = (count) => `${'val a = 1\n'.repeat(count)}`

test('every COD check is NOT RUN while the stack is pending', () => {
  for (const id of ['cod-01', 'cod-02', 'cod-03', 'cod-04']) {
    const result = run(id, { 'src/A.kt': 'x' }, [])
    assert.equal(result.code, 2, id)
    assert.match(result.out, /stack pending/)
  }
})

test('COD-01 fails on a framework import inside a domain folder and passes without it', () => {
  const bad = run('cod-01', { 'app/domain/User.kt': 'package x\nimport android.content.Context\nclass User\n' }, ['kotlin'])
  assert.equal(bad.code, 1)
  assert.equal(bad.out.trim(), 'app/domain/User.kt:2 framework, database or UI import inside the domain')
  assert.equal(run('cod-01', { 'app/domain/User.kt': 'package x\nimport kotlin.math.max\n', 'app/data/Repo.kt': 'import android.os.Bundle\n' }, ['kotlin']).code, 0)
  const web = run('cod-01', { 'src/domain/user.ts': "import { useState } from 'react'\n" }, ['astro-react'])
  assert.deepEqual([web.code, web.out.trim()], [1, 'src/domain/user.ts:1 framework, database or UI import inside the domain'])
})

test('COD-01 is NOT RUN without a domain folder and uses domain_dir from harness.yaml', () => {
  assert.equal(run('cod-01', { 'src/A.kt': 'x' }, ['kotlin']).code, 2)
  const dir = project({ stacks: ['kotlin'], files: { 'core/User.kt': 'import androidx.room.Dao\n' } })
  write(dir, '.abmh/harness.yaml', 'docsDir: 00-docs\ndomain_dir: core\n')
  assert.equal(sh(dir, 'cod-01.sh').code, 1)
})

test('COD-02 fails on a source file over 300 lines and names it', () => {
  const bad = run('cod-02', { 'src/Big.kt': lines(301), 'src/Ok.kt': lines(300) }, ['kotlin'])
  assert.equal(bad.code, 1)
  assert.equal(bad.out.trim(), 'src/Big.kt:301 more than 300 lines')
  assert.equal(run('cod-02', { 'src/Ok.kt': lines(300) }, ['kotlin']).code, 0)
  assert.equal(run('cod-02', { 'src/big.ts': lines(301), 'build/Gen.kt': lines(999) }, ['astro-react', 'kotlin']).code, 1)
})

test('COD-03 fails on comments in both stacks, allows tool directives and never prints the line', () => {
  const kotlin = run('cod-03', { 'A.kt': 'class A {\n    // secret note\n    val x = 1 // trailing\n}\n' }, ['kotlin'])
  assert.equal(kotlin.code, 1)
  assert.deepEqual(kotlin.out.trim().split('\n'), ['A.kt:2 code comment', 'A.kt:3 code comment'])
  assert.doesNotMatch(kotlin.out, /secret/)
  const web = run('cod-03', { 'a.tsx': '/* block */\nconst a = 1\n', 'b.astro': '<!-- html -->\n<p>x</p>\n' }, ['astro-react'])
  assert.equal(web.code, 1)
  assert.match(web.out, /a\.tsx:1/)
  assert.match(web.out, /b\.astro:1/)
  const clean = run('cod-03', { 'a.ts': '// @ts-expect-error\nconst a = 1\n// eslint-disable-next-line\nconst url = "http://x.y"\n', 'B.kt': '@Suppress("x")\nval n = 3 * 2\n' }, ['astro-react', 'kotlin'])
  assert.equal(clean.code, 0, clean.out)
})

test('COD-04 fails on any and Any types but allows the equals override', () => {
  const web = run('cod-04', { 'a.ts': 'const a: any = 1\nconst b = x as any\nconst many = anything\n' }, ['astro-react'])
  assert.deepEqual([web.code, web.out.trim().split('\n')], [1, ['a.ts:1 any type', 'a.ts:2 any type']])
  const kotlin = run('cod-04', { 'A.kt': 'val a: Any = 1\nfun f(x: List<Any>) {}\n' }, ['kotlin'])
  assert.deepEqual([kotlin.code, kotlin.out.trim().split('\n')], [1, ['A.kt:1 any type', 'A.kt:2 any type']])
  assert.equal(run('cod-04', { 'A.kt': 'override fun equals(other: Any?): Boolean = true\nval company = 1\n' }, ['kotlin']).code, 0)
})

test('COD-05 fails on hardcoded UI text, skips tests and listed files, passes with resources', () => {
  const kotlin = run('cod-05', { 'ui/Screen.kt': 'Text("Save changes")\nText(stringResource(R.string.save))\n', 'ui/ScreenTest.kt': 'Text("Fixture")\n' }, ['kotlin'])
  assert.deepEqual([kotlin.code, kotlin.out.trim()], [1, 'ui/Screen.kt:1 UI text outside the i18n resources'])
  const web = run('cod-05', { 'a.tsx': '<p>Hello world</p>\n<img alt="Logo mark" />\n<p>{t("hello")}</p>\n' }, ['astro-react'])
  assert.deepEqual([web.code, web.out.trim().split('\n').length], [1, 2])
  assert.equal(run('cod-05', { 'a.tsx': '<p>{t("hello")}</p>\n' }, ['astro-react']).code, 0)
  const dir = project({ stacks: ['astro-react'], files: { 'a.tsx': '<p>Hello world</p>\n' } })
  write(dir, '00-docs/ui-allowlist.txt', 'a.tsx\n')
  assert.equal(sh(dir, 'cod-05.sh').code, 0)
})

test('COD-06 fails on a top-level signature repeated in two files and ignores tests, main and nested methods', () => {
  const bad = run('cod-06', { 'a.ts': 'export function formatDate(value: string) {\n}\n', 'b.ts': 'export function formatDate(value: string) {\n}\n' }, ['astro-react'])
  assert.deepEqual([bad.code, bad.out.trim()], [1, 'formatDate(value: string) duplicated in a.ts b.ts'])
  const ok = run('cod-06', { 'a.ts': 'function main() {}\nfunction one(a: string) {}\n', 'b.ts': 'function main() {}\nfunction two(a: string) {}\n', 'c.test.ts': 'function one(a: string) {}\n' }, ['astro-react'])
  assert.equal(ok.code, 0, ok.out)
  const kotlin = run('cod-06', { 'A.kt': 'fun parse(text: String): Int = 1\n', 'B.kt': 'fun parse(text: String): Int = 2\n', 'C.kt': 'class C {\n    fun parse(text: String): Int = 3\n}\n' }, ['kotlin'])
  assert.deepEqual([kotlin.code, kotlin.out.trim()], [1, 'parse(text: String) duplicated in A.kt B.kt'])
})

const committed = (files, stacks) => {
  const dir = project({ files, stacks })
  const git = (...args) => spawnSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', ...args])
  git('add', '-A')
  git('commit', '-qm', 'base')
  return { dir, git }
}

test('COD-07 fails when source changed without a test, passes with a test or docs only, NOT RUN outside git', () => {
  const { dir } = committed({ 'src/A.kt': 'class A\n', 'README.md': 'x' }, ['kotlin'])
  assert.equal(sh(dir, 'cod-07.sh').code, 0)
  write(dir, 'README.md', 'y')
  assert.equal(sh(dir, 'cod-07.sh').code, 0)
  write(dir, 'src/A.kt', 'class A2\n')
  const bad = sh(dir, 'cod-07.sh')
  assert.deepEqual([bad.code, bad.out.trim()], [1, '1 source files changed and no test file changed'])
  write(dir, 'src/test/ATest.kt', 'class ATest\n')
  assert.equal(sh(dir, 'cod-07.sh').code, 0)
  assert.equal(sh(project({ stacks: ['kotlin'], git: false }), 'cod-07.sh').code, 2)
})

test('COD-07 compares against ABMH_BASE when it is set', () => {
  const { dir, git } = committed({ 'src/a.ts': 'export const a = 1\n' }, ['astro-react'])
  write(dir, 'src/a.ts', 'export const a = 2\n')
  git('commit', '-qam', 'change')
  assert.equal(sh(dir, 'cod-07.sh').code, 0)
  const result = sh(dir, 'cod-07.sh', [], { ABMH_BASE: 'HEAD~1' })
  assert.equal(result.code, 1)
})

test('COD-08 passes with the harness hook, fails when it was installed and lost, NOT RUN when skipped', () => {
  const dir = project({})
  assert.equal(sh(dir, 'cod-08.sh').code, 2)
  spawnSync('git', ['-C', dir, 'config', 'core.hooksPath', '.abmh/hooks'])
  assert.equal(sh(dir, 'cod-08.sh').code, 0)
  spawnSync('git', ['-C', dir, 'config', '--unset', 'core.hooksPath'])
  write(dir, '.abmh/manifest.json', '{"entries":[{"kind":"gitconfig","key":"core.hooksPath"}]}')
  assert.equal(sh(dir, 'cod-08.sh').code, 1)
  assert.equal(sh(project({ git: false }), 'cod-08.sh').code, 2)
})

test('COD-09 fails on other package managers and passes with pnpm only', () => {
  const [manager, runner] = ['n' + 'pm', 'n' + 'px']
  const bad = project({ files: { 'package.json': `{"scripts":{"build":"${runner} astro build"}}`, 'package-lock.json': '{}', 'ci.yml': `run: ${manager} install\n` } })
  const result = sh(bad, 'cod-09.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /package-lock\.json: use pnpm/)
  assert.match(result.out, /package\.json:1 other package manager call/)
  assert.match(result.out, /ci\.yml:1 other package manager call/)
  assert.equal(sh(project({ files: { 'package.json': '{"scripts":{"build":"pnpm astro build"}}', 'pnpm-lock.yaml': '' } }), 'cod-09.sh').code, 0)
  assert.equal(sh(project({ files: { 'a.txt': 'x' } }), 'cod-09.sh').code, 2)
})

test('review fixes: route handlers, private helpers, Company[], subpath imports, spaces, inline comments', () => {
  assert.equal(run('cod-06', { 'a.ts': 'export async function getStaticPaths() {}\nexport function GET(context: X) {}\n', 'b.ts': 'export async function getStaticPaths() {}\nexport function GET(context: X) {}\n' }, ['astro-react']).code, 0)
  assert.equal(run('cod-06', { 'A.kt': 'private fun h(x: Int) = 1\n', 'B.kt': 'private fun h(x: Int) = 2\n' }, ['kotlin']).code, 0)
  assert.equal(run('cod-04', { 'a.ts': 'export function f(x: Company[]) {}\n' }, ['astro-react']).code, 0)
  assert.equal(run('cod-04', { 'a.ts': 'const x: any[] = []\n' }, ['astro-react']).code, 1)
  for (const spec of ['react-dom/client', 'react/jsx-runtime', 'astro:content', 'next/image']) {
    assert.equal(run('cod-01', { 'src/domain/a.ts': `import x from "${spec}"\n` }, ['astro-react']).code, 1, spec)
  }
  assert.equal(run('cod-01', { 'my dir/domain/z.ts': "import x from 'react'\n" }, ['astro-react']).code, 1)
  const dir = project({ stacks: ['astro-react'], files: { 'src/core/a.ts': "import x from 'react'\n" } })
  write(dir, '.abmh/harness.yaml', 'domain_dir: ./src/core/\n')
  assert.equal(sh(dir, 'cod-01.sh').code, 1)
  const inline = run('cod-03', { 'a.ts': 'foo(); //todo\nconst a = 1 /* x */\nconst u = "http://x.y"\n' }, ['astro-react'])
  assert.deepEqual(inline.out.trim().split('\n'), ['a.ts:1 code comment', 'a.ts:2 code comment'])
})

test('review fixes: COD-07 ignores the installed harness files, COD-09 ignores prose', () => {
  const dir = project({ stacks: ['astro-react'], files: { 'src/a.ts': 'export const a = 1\n', '.abmh/gates/test.md': '# gate\n' } })
  assert.equal(sh(dir, 'cod-07.sh').code, 1)
  const [manager, runner] = ['n' + 'pm', 'n' + 'px']
  const prose = project({ files: { 'package.json': '{"description":"use yarn instead"}', 'ci.yml': 'name: yarn build\n' } })
  assert.equal(sh(prose, 'cod-09.sh').code, 0)
  const calls = project({ files: { 'package.json': `{"scripts":{"a":"echo && ${runner} x"}}`, 'ci.yml': `jobs:\n  - run: ${manager} test\n    run: |\n      ${manager} ci\n` } })
  assert.match(sh(calls, 'cod-09.sh').out, /package\.json:1[^\n]*\nci\.yml:2[^\n]*\nci\.yml:4/)
})

test('COD-10 fails when a changed file flips its line endings, passes when they are kept, NOT RUN outside git', () => {
  const { dir } = committed({ 'src/Map.tsx': 'a\r\nb\r\n', 'src/b.ts': 'x\n', 'src/new file.ts': 'n\n' }, ['astro-react'])
  assert.equal(sh(dir, 'cod-10.sh').code, 0)
  write(dir, 'src/Map.tsx', 'a\r\nb\r\nc\r\n')
  write(dir, 'src/b.ts', 'y\n')
  assert.equal(sh(dir, 'cod-10.sh').code, 0)
  write(dir, 'src/Map.tsx', 'a\nb\nc\n')
  write(dir, 'src/new file.ts', 'n\r\n')
  const bad = sh(dir, 'cod-10.sh')
  assert.equal(bad.code, 1)
  assert.match(bad.out, /src\/Map\.tsx: line endings changed from CRLF to LF/)
  assert.match(bad.out, /src\/new file\.ts: line endings changed from LF to CRLF/)
  assert.equal(sh(project({ git: false }), 'cod-10.sh').code, 2)
})
