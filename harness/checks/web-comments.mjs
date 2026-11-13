export const isToolDirective = (text) => /@ts-|eslint-|prettier-ignore|biome-ignore|SPDX|noinspection/.test(text) ||
  /^\/\*\s*@vite-ignore\s*\*\/$/.test(text.trim()) || /^\/\/\s*@vitest-environment\s+[\w./-]+\s*$/.test(text.trim())

export function cssComments(source) {
  const found = []
  let quote
  for (let position = 0; position < source.length; position++) {
    const character = source[position]
    if (character === '\\') {
      position++
    } else if (quote) {
      if (character === quote) quote = undefined
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (source.startsWith('/*', position)) {
      const end = source.indexOf('*/', position + 2)
      if (end === -1) throw new Error('Unterminated CSS comment')
      if (!isToolDirective(source.slice(position, end + 2))) found.push(position)
      position = end + 1
    }
  }
  return found
}
