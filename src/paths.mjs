import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { refused, usageError } from './errors.mjs'
import { lstatOrNull } from './fsutil.mjs'
import { gitTop } from './git.mjs'

export const isInside = (root, target) => target === root || target.startsWith(`${root}${path.sep}`)

export function resolveRoot(cwd, flagRoot) {
  let root
  try {
    root = fs.realpathSync(path.resolve(cwd, flagRoot ?? '.'))
  } catch {
    throw usageError(`project root not found: ${flagRoot ?? cwd}`)
  }
  if (root === path.parse(root).root || root === fs.realpathSync(os.homedir())) {
    throw refused(`${root} is not a project root`)
  }
  const top = gitTop(root)
  if (top && top !== root && flagRoot === null) {
    throw refused(`${root} is inside the repository ${top}. Run from the repository root or pass --root.`)
  }
  return { root, top }
}

export function assertInside(root, target) {
  const resolved = path.resolve(target)
  if (!isInside(root, resolved)) throw refused(`${resolved} is outside the project root`)
  let current = root
  for (const part of path.relative(root, path.dirname(resolved)).split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    const stat = lstatOrNull(current)
    if (stat === null) return
    if (stat.isSymbolicLink()) assertLinkInside(root, current)
  }
}

function assertLinkInside(root, link) {
  let real
  try {
    real = fs.realpathSync(link)
  } catch {
    throw refused(`${link} is a dangling symlink`)
  }
  if (!isInside(root, real)) throw refused(`${link} resolves outside the project root`)
}

export function assertEditable(root, file) {
  assertInside(root, file)
  if (fs.existsSync(file) && !isInside(root, fs.realpathSync(file))) {
    throw refused(`${file} points outside the project root`)
  }
  return fs.existsSync(file) ? fs.realpathSync(file) : file
}
