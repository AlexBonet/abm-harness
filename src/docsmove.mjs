import fs from 'node:fs'
import path from 'node:path'
import { backupBase, createBackup, extractBackup, readSidecar, sidecarOf, stampOf, writeSidecar } from './backup.mjs'
import { NEW_DIR, OLD_DIR, insideOld, mapped, rewrite, scanProject } from './docsscan.mjs'
import { applyFailed, planChanged, refused } from './errors.mjs'
import { atomicWrite, canonicalJson, fileSha, lstatOrNull, sha256 } from './fsutil.mjs'
import { isInside, resolveRoot } from './paths.mjs'

const listDir = (target) => (lstatOrNull(target)?.isDirectory() ? fs.readdirSync(target) : null)

function checkConflicts(root) {
  const old = lstatOrNull(path.join(root, OLD_DIR))
  if (old === null || !old.isDirectory() || old.isSymbolicLink()) throw refused(`${OLD_DIR}/ is not a folder in ${root}; nothing to migrate`)
  const target = path.join(root, NEW_DIR)
  const present = lstatOrNull(target)
  if (present !== null && (!present.isDirectory() || fs.readdirSync(target).length > 0)) {
    throw refused(`${NEW_DIR}/ already exists with content in ${root}; nothing was touched`)
  }
}

function realAncestor(target) {
  let current = target
  const tail = []
  while (lstatOrNull(current) === null && current !== path.dirname(current)) {
    tail.unshift(path.basename(current))
    current = path.dirname(current)
  }
  return path.join(fs.realpathSync(current), ...tail)
}

const pickBackupDir = (root, cwd, flag) => {
  const dir = flag === null ? path.join(path.dirname(root), '_backups') : path.resolve(cwd, flag)
  if (isInside(root, dir) || isInside(root, realAncestor(dir))) throw refused(`the backup folder ${dir} is inside the project; choose one outside it with --backup-dir`)
  return dir
}

export function migratePlan({ root, cwd, args }) {
  checkConflicts(root)
  const backupDir = pickBackupDir(root, cwd, args.backupDir)
  const { edited, mentions, skipped } = scanProject(root)
  const base = { command: 'migrate', root, backupDir, edited, mentions, skipped }
  return { ...base, id: sha256(canonicalJson(base)) }
}

const outsideOf = (plan) => plan.edited.map((file) => file.path).filter((rel) => !insideOld(rel))

export function formatMigratePlan(plan, args, invokedAs) {
  const outside = outsideOf(plan).length
  const lines = [
    `abmh migrate plan for ${plan.root}`,
    `plan id: ${plan.id}`,
    '[backup]',
    `  save ${plan.backupDir}/${path.basename(plan.root)}-<timestamp>.tar.gz and a .json record (${OLD_DIR}/ and ${outside} edited ${outside === 1 ? 'file' : 'files'} outside it)`,
    '[rename]',
    `  rename ${OLD_DIR}/ -> ${NEW_DIR}/`,
    '[rewrite]',
    ...plan.edited.map((file) => `  edit ${file.path} (${file.count} ${file.count === 1 ? 'replacement' : 'replacements'})`),
  ]
  if (plan.edited.length === 0) lines.push('  nothing to rewrite')
  if (plan.mentions.length + plan.skipped.length > 0) lines.push('[kept]')
  lines.push(...plan.mentions.map((item) => `  mention kept ${item.path} (${item.count}, no slash after the name; check it by hand) line ${item.line}: ${item.snippet}`))
  lines.push(...plan.skipped.map((item) => `  skip ${item.path} - ${item.reason}`))
  const flags = [`--accept-plan ${plan.id}`]
  if (args.root !== null) flags.push(`--root ${args.root}`)
  if (args.backupDir !== null) flags.push(`--backup-dir ${args.backupDir}`)
  lines.push('', 'Nothing is written until you accept this exact plan:', `  ${invokedAs} migrate ${flags.join(' ')}`)
  return lines.join('\n')
}

function prepare(plan) {
  return plan.edited.map((file) => {
    const data = fs.readFileSync(path.join(plan.root, file.path))
    if (sha256(data) !== file.sha256) throw planChanged()
    const next = Buffer.from(rewrite(data.toString('utf8')))
    return { ...file, afterPath: mapped(file.path), afterSha: sha256(next), next }
  })
}

export function applyMigrate(plan, now) {
  checkConflicts(plan.root)
  const base = backupBase(plan.root, now)
  const file = createBackup({ root: plan.root, dir: plan.backupDir, base, outside: outsideOf(plan) })
  let prepared
  try {
    prepared = prepare(plan)
  } catch (error) {
    fs.rmSync(file, { force: true })
    throw error
  }
  writeSidecar(file, {
    root: plan.root,
    createdAt: now.toISOString(),
    renamed: { from: OLD_DIR, to: NEW_DIR },
    edited: prepared.map(({ path: from, afterPath, sha256: beforeSha, afterSha }) => ({ path: from, afterPath, beforeSha, afterSha })),
  })
  try {
    fs.renameSync(path.join(plan.root, OLD_DIR), path.join(plan.root, NEW_DIR))
    for (const item of prepared) {
      const target = path.join(plan.root, item.afterPath)
      if (!lstatOrNull(target)?.isFile()) throw new Error(`${item.afterPath} is no longer a regular file`)
      atomicWrite(target, item.next, fs.statSync(target).mode & 0o777)
    }
  } catch (error) {
    throw applyFailed(`${error.message}. The saved copy is ${file}; restore it with: migrate --restore ${file}`)
  }
  return { file, count: prepared.length }
}

export function restorePlan({ root, cwd, args }) {
  const file = path.resolve(cwd, args.restore)
  const record = readSidecar(file)
  if (record.root !== root) throw refused(`this backup belongs to ${record.root}, not to ${root}`)
  if (lstatOrNull(path.join(root, OLD_DIR)) !== null) throw refused(`${OLD_DIR}/ already exists in ${root}; nothing was touched`)
  const aside = `${NEW_DIR}.restored-${stampOf(new Date(record.createdAt))}`
  if (lstatOrNull(path.join(root, aside)) !== null) throw refused(`${aside}/ already exists; remove or rename it first`)
  const changed = record.edited.filter((item) => fileSha(path.join(root, item.afterPath)) !== item.afterSha).map((item) => item.path)
  const base = { command: 'restore', root, file, backupSha: fileSha(file), aside, changed, hasNewDir: listDir(path.join(root, NEW_DIR)) !== null }
  return { ...base, id: sha256(canonicalJson(base)), record }
}

export function formatRestorePlan(plan, args, invokedAs) {
  const lines = [`abmh migrate restore plan for ${plan.root}`, `plan id: ${plan.id}`, '[restore]']
  if (plan.hasNewDir) lines.push(`  move ${NEW_DIR}/ aside to ${plan.aside}/ (nothing is deleted)`)
  lines.push(`  extract ${plan.file} into the project (${OLD_DIR}/ and ${plan.record.edited.filter((item) => !insideOld(item.path)).length} edited files outside it)`)
  if (plan.changed.length > 0) {
    lines.push('[changed since the migration]')
    lines.push(...plan.changed.map((item) => (insideOld(item) ? `  ${item} differs from what the migration wrote; it stays in ${plan.aside}/` : `  ${item} differs from what the migration wrote; it will be overwritten by the saved copy`)))
  }
  const flags = [`--restore ${args.restore}`, `--accept-plan ${plan.id}`]
  if (args.root !== null) flags.push(`--root ${args.root}`)
  lines.push('', 'Nothing is written until you accept this exact plan:', `  ${invokedAs} migrate ${flags.join(' ')}`)
  return lines.join('\n')
}

export function applyRestore(plan) {
  try {
    if (plan.hasNewDir) fs.renameSync(path.join(plan.root, NEW_DIR), path.join(plan.root, plan.aside))
    extractBackup(plan.file, plan.root)
  } catch (error) {
    throw applyFailed(`${error.message}. Nothing was deleted; ${plan.aside}/ may hold the previous ${NEW_DIR}/`)
  }
}

export function runMigrate(args, io) {
  const { root } = resolveRoot(io.cwd, args.root)
  const now = io.inject.now ?? new Date()
  if (args.restore !== null) {
    const plan = restorePlan({ root, cwd: io.cwd, args })
    if (args.acceptPlan === null) return io.out(formatRestorePlan(plan, args, io.invokedAs))
    if (args.acceptPlan !== plan.id) throw planChanged()
    applyRestore(plan)
    return io.out(`migrate restore done: ${plan.file} extracted (plan ${plan.id.slice(0, 12)})`)
  }
  const plan = migratePlan({ root, cwd: io.cwd, args })
  if (args.acceptPlan === null) return io.out(formatMigratePlan(plan, args, io.invokedAs))
  if (args.acceptPlan !== plan.id) throw planChanged()
  const done = applyMigrate(plan, now)
  return io.out(`migrate done: ${NEW_DIR}/ renamed, ${done.count} files edited, backup ${done.file} (plan ${plan.id.slice(0, 12)})`)
}
