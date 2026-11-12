export const FLAVORS = ['install', 'root']

export const TOKENS = {
  SUMMARY: { root: 'Resumen Alex', install: 'Resumen' },
  ASK_OWNER: { root: 'pídeselo a Alex', install: 'pídeselo a la persona responsable' },
  ABMH: { root: '_system/', install: '.abmh/' },
  CORE: { root: '_system/', install: '.abmh/core/' },
  OWNER: { root: 'Alex', install: 'the human' },
}

const PATTERN = /\{\{([A-Z_]+)\}\}/g

export const render = (text, flavor, extra = {}) =>
  text.replace(PATTERN, (match, name) => extra[name] ?? TOKENS[name]?.[flavor] ?? match)
