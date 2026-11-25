import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeRepo, read, tempDir } from './helpers.mjs'

export const HARNESS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../harness')
const STUB = `#!/bin/sh
printf '%s\\n' "$(basename "$0") $*" >> "$STUB_LOG"
all="$*"
out=""
while [ $# -gt 0 ]; do
  [ "$1" = "-o" ] && out=$2
  shift
done
field() { printf '%s\\n' "$all" | sed -n "s/.*'\\($1: [^']*\\)'.*/\\1/p" | head -n 1; }
if [ -n "$STUB_RAW" ]; then
  answer=$STUB_VERDICT
else
  answer=$(printf '%s\\n' "$STUB_VERDICT" | head -n 1; echo 'Tier: medio'; field Diff; field Reviewer; field Round; printf '%s\\n' "$STUB_VERDICT" | tail -n +2)
fi
if [ -n "$out" ]; then printf '%s\\n' "$answer" > "$out"; else printf '%s\\n' "$answer"; fi
`

export function project({ yaml = '', stubs = ['codex', 'claude'] } = {}) {
  const dir = makeRepo({ 'a.txt': 'one\n', '.gitignore': '.abmh/\n' })
  execFileSync('git', ['-C', dir, 'add', '.'])
  execFileSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base'])
  fs.mkdirSync(path.join(dir, '.abmh/reviewer'), { recursive: true })
  for (const name of fs.readdirSync(path.join(HARNESS, 'reviewer'))) fs.copyFileSync(path.join(HARNESS, 'reviewer', name), path.join(dir, '.abmh/reviewer', name))
  fs.writeFileSync(path.join(dir, '.abmh/harness.yaml'), `version: x\n${yaml}`)
  const bin = tempDir()
  for (const name of stubs) fs.writeFileSync(path.join(bin, name), STUB, { mode: 0o755 })
  return { dir, bin, log: path.join(bin, 'calls.log') }
}

export function review(p, args, verdict = 'APPROVED', raw = false) {
  const env = { PATH: `${p.bin}:/usr/bin:/bin`, STUB_LOG: p.log, STUB_VERDICT: verdict, HOME: p.bin, ...(raw ? { STUB_RAW: '1' } : {}) }
  return spawnSync('sh', [path.join(p.dir, '.abmh/reviewer/review.sh'), ...args], { cwd: p.dir, env, encoding: 'utf8' })
}

export function guard(p, mode, input, extra = {}) {
  const env = { PATH: '/usr/bin:/bin', HOME: p.bin, ...extra }
  return spawnSync('sh', [path.join(p.dir, '.abmh/reviewer/guard.sh'), mode], { cwd: p.dir, env, input: JSON.stringify(input), encoding: 'utf8' })
}

export const calls = (p) => (fs.existsSync(p.log) ? read(p.log, '') : '')
export const change = (p, text = 'two\n') => fs.writeFileSync(path.join(p.dir, 'a.txt'), text)

export function track(p, mode, input) {
  return spawnSync('sh', [path.join(p.dir, '.abmh/reviewer/track.sh'), mode], { cwd: p.dir, env: { PATH: '/usr/bin:/bin', HOME: p.bin }, input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8' })
}

export function write(p, session, rel, text) {
  const file = path.join(p.dir, rel)
  track(p, 'pre', { session_id: session, tool_name: 'Write' })
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  track(p, 'post', { session_id: session, tool_name: 'Write', tool_input: { file_path: file, content: text } })
}
