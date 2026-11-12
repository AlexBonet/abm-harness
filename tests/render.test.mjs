import assert from 'node:assert/strict'
import { test } from 'node:test'
import { render } from '../src/render.mjs'

test('render replaces each token per flavor', () => {
  const text = '{{SUMMARY}} | {{ASK_OWNER}} | {{CORE}}x | {{OWNER}}'
  assert.equal(render(text, 'root'), 'Resumen Alex | pídeselo a Alex | _system/x | Alex')
  assert.equal(render(text, 'install'), 'Resumen | pídeselo a la persona responsable | .abmh/core/x | the human')
})

test('render leaves unknown tokens and takes extra values', () => {
  assert.equal(render('{{OTHER}} {{DOCS}}', 'install', { DOCS: 'notes' }), '{{OTHER}} notes')
})

test('render keeps names that only contain a token word', () => {
  assert.equal(render('Alexandria', 'install'), 'Alexandria')
})

test('render points {{ABMH}} at .abmh/ when installed and at _system/ at the root', () => {
  assert.equal(render('{{ABMH}}lanes/bug.md', 'install'), '.abmh/lanes/bug.md')
  assert.equal(render('{{ABMH}}lanes/bug.md', 'root'), '_system/lanes/bug.md')
})
