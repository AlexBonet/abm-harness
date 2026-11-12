import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

export function gitTop(dir) {
  try {
    return fs.realpathSync(git(dir, ['rev-parse', '--show-toplevel']))
  } catch {
    return null
  }
}

export function readConfig(root, key, localOnly = false) {
  try {
    const value = git(root, ['config', ...(localOnly ? ['--local'] : []), '--get', key])
    return value === '' ? null : value
  } catch {
    return null
  }
}

export const setLocalConfig = (root, key, value) => git(root, ['config', '--local', key, value])

export const unsetLocalConfig = (root, key) => git(root, ['config', '--local', '--unset', key])

export const hooksDir = (root) => path.resolve(root, git(root, ['rev-parse', '--git-path', 'hooks']))
