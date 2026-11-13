import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

test('the migration fixtures pass against the shipped data checks', () => {
  const result = spawnSync('sh', [path.join(HERE, 'fixtures/mig-fixtures.sh')], { env: { ...process.env, CHECKS: path.join(HERE, '../harness/checks') }, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /39 passed, 0 failed/)
})
