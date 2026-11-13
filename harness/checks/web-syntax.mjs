import { astroSource } from './web-astro.mjs'
import { isToolDirective } from './web-comments.mjs'

const visibleAttribute = /^(alt|title|placeholder|aria-label)$/
const hasLetters = /\p{L}/u

function inRawElement(ts, node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent) && /^(script|style)$/.test(parent.openingElement.tagName.getText())) return true
  }
  return false
}

export async function inspectSyntax(ts, requireProject, file, source, rule) {
  const astro = file.endsWith('.astro') ? await astroSource(ts, requireProject, file, source) : undefined
  const text = astro?.code ?? source
  const jsx = astro || /\.(tsx|jsx|[cm]?js)$/.test(file)
  const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const diagnostic = parsed.parseDiagnostics[0]
  if (diagnostic) throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '))
  const found = []
  const report = (position, token, message) => {
    const original = astro ? astro.originalOffset(position) : position
    if (original === undefined || source.slice(original, original + token.length) !== token) return
    const line = source.slice(0, original).split('\n').length
    found.push(`${file}:${line} ${message}`)
  }
  const commentRanges = new Map()
  const literalRanges = []
  const collectComments = (node) => {
    if (ts.isJsxText(node) || ts.isLiteralExpression(node) ||
        [ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail].includes(node.kind)) {
      literalRanges.push([node.getStart(parsed), node.end])
    }
    for (const position of [node.pos, node.end]) {
      for (const range of [...ts.getLeadingCommentRanges(text, position) ?? [], ...ts.getTrailingCommentRanges(text, position) ?? []]) {
        commentRanges.set(range.pos, range)
      }
    }
    for (const child of node.getChildren(parsed)) collectComments(child)
  }
  const literalValue = (node) => {
    while (node && ts.isParenthesizedExpression(node)) node = node.expression
    return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node : undefined
  }
  const visit = (node) => {
    if (rule === 'COD-04' && node.kind === ts.SyntaxKind.AnyKeyword) {
      report(node.getStart(parsed), 'any', 'any type')
    }
    if (rule === 'COD-05' && !inRawElement(ts, node)) {
      if (ts.isJsxText(node) && hasLetters.test(node.text)) {
        report(node.pos, node.text, 'UI text outside the i18n resources')
      }
      if (ts.isJsxAttribute(node) && visibleAttribute.test(node.name.getText(parsed)) && node.initializer) {
        const value = literalValue(ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer)
        if (value && hasLetters.test(value.text)) {
          report(value.getStart(parsed), value.getText(parsed), 'UI text outside the i18n resources')
        }
      }
      if (ts.isJsxExpression(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
        const value = literalValue(node.expression)
        if (value && hasLetters.test(value.text)) report(value.getStart(parsed), value.getText(parsed), 'UI text outside the i18n resources')
      }
    }
    ts.forEachChild(node, visit)
  }
  if (rule === 'COD-03') {
    collectComments(parsed)
    const references = [...parsed.typeReferenceDirectives, ...parsed.libReferenceDirectives, ...parsed.referencedFiles]
    for (const range of commentRanges.values()) {
      const comment = text.slice(range.pos, range.end)
      const literal = literalRanges.some(([start, end]) => range.pos >= start && range.pos < end)
      const reference = references.some((item) => range.pos <= item.pos && range.end >= item.end)
      if (!literal && !reference && !isToolDirective(comment)) report(range.pos, comment, 'code comment')
    }
    found.push(...astro?.comments ?? [])
  } else {
    visit(parsed)
  }
  return found
}
