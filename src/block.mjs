export const START = '<!-- abmh:start -->'
export const END = '<!-- abmh:end -->'

export const buildBlock = (docsDir) =>
  [
    START,
    '## ABMH harness',
    '',
    'Before working, read `.abmh/core/AGENT_BASELINE.md`: it holds the working rules, the lanes and the review flow.',
    'Templates live in `.abmh/core/templates/` and protocols in `.abmh/core/protocols/`.',
    'Skills are exposed through `.agents/skills/` and `.claude/skills/`.',
    `Project docs live in \`${docsDir}/\` (start with \`LEEME.md\`).`,
    `Record decisions in \`${docsDir}/decisions/\` (read it before proposing something big).`,
    `Before using an external service, read \`${docsDir}/tools/<name>/README.md\`; run its \`test_connection\` only if the sheet says it is safe for an agent.`,
    "When an instruction of this project conflicts with the harness, the project's instruction wins.",
    END,
  ].join('\n')

const countOf = (text, marker) => text.split(marker).length - 1

export function inspectBlock(text) {
  const starts = countOf(text, START)
  const ends = countOf(text, END)
  if (starts === 0 && ends === 0) return { state: 'absent' }
  if (starts === 1 && ends === 1 && text.indexOf(START) < text.indexOf(END)) return { state: 'present' }
  return { state: 'broken', detail: `${starts} start and ${ends} end markers` }
}

export const detectEol = (text) => (text.includes('\r\n') ? '\r\n' : '\n')

export const normalizeEol = (text) => text.replaceAll('\r\n', '\n')

export const toEol = (text, eol) => normalizeEol(text).replaceAll('\n', eol)

export function extractBlock(text) {
  return text.slice(text.indexOf(START), text.indexOf(END) + END.length)
}

export function insertBlock(text, block, eol) {
  if (text === '') return { text: `${block}${eol}`, prefix: '' }
  const prefix = text.endsWith('\n') ? eol : `${eol}${eol}`
  return { text: `${text}${prefix}${block}${eol}`, prefix }
}

export function replaceBlock(text, block) {
  const start = text.indexOf(START)
  const end = text.indexOf(END) + END.length
  return `${text.slice(0, start)}${block}${text.slice(end)}`
}

export function removeBlock(text, prefix, eol) {
  const start = text.indexOf(START)
  const blockEnd = text.indexOf(END) + END.length
  const tail = text.startsWith(eol, blockEnd) ? eol.length : 0
  const cutFrom = text.slice(0, start).endsWith(prefix) ? start - prefix.length : start
  return `${text.slice(0, cutFrom)}${text.slice(blockEnd + tail)}`
}
