import fs from 'node:fs'
import path from 'node:path'
import { refused } from './errors.mjs'

function isAlive(pid) {
  if (!Number.isInteger(pid)) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

export function acquireLock(root) {
  const dir = path.join(root, '.abmh')
  const file = path.join(dir, '.lock')
  fs.mkdirSync(dir, { recursive: true })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.writeFileSync(file, String(process.pid), { flag: 'wx' })
      return () => fs.rmSync(file, { force: true })
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const pid = Number.parseInt(fs.readFileSync(file, 'utf8'), 10)
      if (isAlive(pid)) throw refused(`another abmh run is active (pid ${pid})`)
      fs.rmSync(file, { force: true })
    }
  }
  throw refused('could not take the .abmh lock')
}
