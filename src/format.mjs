const FILE_OPS = ['create-file', 'update-file', 'delete-file']

const groupKey = (action) => {
  const parts = action.path.split('/')
  return parts.length > 2 ? `${parts.slice(0, 2).join('/')}/` : action.path
}

function describe(action) {
  if (action.op === 'link') return `link ${action.path} -> ${action.target} - ${action.reason}`
  if (action.op === 'config') return `config ${action.key}=${action.value} - ${action.reason}`
  return `${action.op} ${action.path} - ${action.reason}`
}

function groupLines(actions) {
  const lines = []
  const collapsed = new Map()
  for (const action of actions) {
    if (!FILE_OPS.includes(action.op)) {
      lines.push(describe(action))
      continue
    }
    const key = `${action.op} ${groupKey(action)}`
    const bucket = collapsed.get(key) ?? { count: 0, reason: action.reason }
    bucket.count += 1
    collapsed.set(key, bucket)
  }
  const files = [...collapsed].map(([key, bucket]) => `${key} (${bucket.count} ${bucket.count === 1 ? 'file' : 'files'}) - ${bucket.reason}`)
  return [...files, ...lines]
}

export function acceptCommand(plan, args, invokedAs) {
  const flags = [`--accept-plan ${plan.id}`]
  if (plan.command === 'init') {
    if (args.assistants.length !== 5) flags.push(`--assistants ${args.assistants.join(',')}`)
    if (args.lang !== 'es') flags.push(`--lang ${args.lang}`)
    if (args.profile !== 'universal') flags.push(`--profile ${args.profile}`)
    if (args.noHooks) flags.push('--no-hooks')
    if (args.ci) flags.push('--ci')
    if (args.docsDir !== null) flags.push(`--docs-dir ${args.docsDir}`)
  }
  if (plan.command === 'update' && args.docsDir !== null) flags.push(`--docs-dir ${args.docsDir}`)
  if (args.packs.length > 0) flags.push(`--packs ${args.packs.join(',')}`)
  if (args.root !== null) flags.push(`--root ${args.root}`)
  return `${invokedAs} ${plan.command} ${flags.join(' ')}`
}

export function formatPlan(plan, args, root, invokedAs) {
  const groups = new Map()
  for (const action of plan.actions) {
    groups.set(action.group, [...(groups.get(action.group) ?? []), action])
  }
  const lines = [`abmh ${plan.command} plan for ${root}`, `plan id: ${plan.id}`]
  for (const [group, actions] of groups) {
    lines.push(`[${group}]`, ...groupLines(actions).map((line) => `  ${line}`))
  }
  lines.push('', 'Nothing is written until you accept this exact plan:', `  ${acceptCommand(plan, args, invokedAs)}`)
  return lines.join('\n')
}
