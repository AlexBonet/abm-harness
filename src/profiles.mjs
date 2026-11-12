import fs from 'node:fs'
import path from 'node:path'
import { HARNESS_DIR } from './harness.mjs'
import { usageError } from './errors.mjs'

export const PROFILES = ['universal', 'abm-estricto']
export const PROFILES_FILE = 'profiles.json'

const strictOnly = () => JSON.parse(fs.readFileSync(path.join(HARNESS_DIR, PROFILES_FILE), 'utf8')).strictOnly

export const inProfile = (profile, rel) => profile === 'abm-estricto' || !strictOnly().includes(rel)

export function parseProfile(value) {
  if (value === undefined) return 'universal'
  if (!PROFILES.includes(value)) throw usageError(`invalid --profile ${value}. Valid: ${PROFILES.join(', ')}`)
  return value
}
