import path from 'node:path'

const SOURCE = 'github:AlexBonet/abm-harness'

export function invokedName(scriptPath, version) {
  if (scriptPath.split(path.sep).includes('node_modules')) return `pnpm dlx ${SOURCE}#v${version}`
  return `node ${scriptPath}`
}
