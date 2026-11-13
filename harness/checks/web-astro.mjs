import { SourceMap } from 'node:module'
import { cssComments, isToolDirective } from './web-comments.mjs'

export async function astroSource(ts, requireProject, file, source) {
  const { convertToTSX, parse } = requireProject('@astrojs/compiler')
  const result = await convertToTSX(source, { filename: file, includeScripts: true, includeStyles: false })
  const ast = await parse(source)
  const errors = [...result.diagnostics, ...ast.diagnostics].filter((item) => item.severity === 1)
  if (errors.length) throw new Error(errors.map((item) => item.text).join('; '))
  const map = new SourceMap(result.map)
  const generatedLines = [0]
  const originalLines = [0]
  for (let i = 0; i < result.code.length; i++) if (result.code[i] === '\n') generatedLines.push(i + 1)
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') originalLines.push(i + 1)
  const comments = []
  const visit = (node) => {
    if (node.type === 'comment' && !isToolDirective(node.value)) comments.push(`${file}:${node.position.start.line} code comment`)
    if (node.type === 'frontmatter') {
      const frontmatter = ts.createSourceFile(file + '.ts', node.value, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      if (frontmatter.parseDiagnostics.length) throw new Error('Invalid Astro frontmatter: ' + ts.flattenDiagnosticMessageText(frontmatter.parseDiagnostics[0].messageText, ' '))
    }
    if (node.type === 'element' && node.name === 'style') {
      for (const child of node.children) {
        for (const offset of cssComments(child.value ?? '')) {
          const line = child.position.start.line + child.value.slice(0, offset).split('\n').length - 1
          comments.push(`${file}:${line} code comment`)
        }
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(ast.ast)
  return {
    code: result.code,
    comments,
    originalOffset(position) {
      let line = 0
      while (line + 1 < generatedLines.length && generatedLines[line + 1] <= position) line++
      const entry = map.findEntry(line, position - generatedLines[line])
      if (entry.originalLine === undefined || entry.originalColumn === undefined) return undefined
      const lineStart = originalLines[entry.originalLine]
      return lineStart === undefined ? undefined : lineStart + entry.originalColumn
    },
  }
}
