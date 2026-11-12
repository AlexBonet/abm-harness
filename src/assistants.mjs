import { listHarnessDir } from './harness.mjs'

const SHARED_SKILLS_ASSISTANTS = ['codex', 'gemini', 'cursor', 'opencode']
const REVIEW_AGENT_PREFIX = 'abms-review-'
const CLAUDE_ONLY_SKILLS = ['abms-spec-review']

export function linkSpecs(selected) {
  const specs = []
  const skills = listHarnessDir('skills')
  if (selected.includes('claude')) {
    for (const skill of skills) {
      specs.push({ path: `.claude/skills/${skill}`, target: `.abmh/skills/${skill}`, group: 'claude' })
    }
    for (const agent of listHarnessDir('agents').filter((name) => name.startsWith(REVIEW_AGENT_PREFIX))) {
      specs.push({ path: `.claude/agents/${agent}`, target: `.abmh/agents/${agent}`, group: 'claude' })
    }
  }
  const shared = selected.filter((name) => SHARED_SKILLS_ASSISTANTS.includes(name))
  if (shared.length > 0) {
    for (const skill of skills.filter((name) => !CLAUDE_ONLY_SKILLS.includes(name))) {
      specs.push({ path: `.agents/skills/${skill}`, target: `.abmh/skills/${skill}`, group: shared.join(', ') })
    }
  }
  return specs
}

export const instructionFiles = (selected) => ['AGENTS.md', ...(selected.includes('gemini') ? ['GEMINI.md'] : [])]
