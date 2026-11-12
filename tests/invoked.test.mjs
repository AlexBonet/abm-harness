import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { invokedName } from '../src/invoked.mjs'

test('a clone run shows the node command with the script path', () => {
  assert.equal(invokedName('/home/dev/abm-harness/bin/abmh.mjs', '0.1.0'), 'node /home/dev/abm-harness/bin/abmh.mjs')
})

test('a run from a package cache shows the pinned pnpm dlx command, never the cache path', () => {
  const cached = ['', 'cache', 'dlx', 'x', 'node_modules', '.pnpm', 'abm-harness@git', 'node_modules', 'abm-harness', 'bin', 'abmh.mjs'].join(path.sep)
  assert.equal(invokedName(cached, '0.1.0'), 'pnpm dlx github:AlexBonet/abm-harness#v0.1.0')
})
