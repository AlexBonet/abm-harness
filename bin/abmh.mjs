#!/usr/bin/env node
import readline from 'node:readline/promises'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { run } from '../src/cli.mjs'
import { interview, needsInterview } from '../src/interview.mjs'
import { invokedName } from '../src/invoked.mjs'

const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const invokedAs = invokedName(fileURLToPath(import.meta.url), version)
let argv = process.argv.slice(2)

if (needsInterview(argv, { stdinTTY: process.stdin.isTTY, stdoutTTY: process.stdout.isTTY })) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    argv = [...argv, ...(await interview(argv, (question) => rl.question(question)))]
  } finally {
    rl.close()
  }
}

process.exitCode = run(argv, { invokedAs })
