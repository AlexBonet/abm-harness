import fs from 'node:fs'
import path from 'node:path'
import { ASSISTANTS } from './args.mjs'
import { parseDocsDir } from './settings.mjs'

const YES = /^(s|si|sí|y|yes)$/i
const MAX_TRIES = 3

const TEXT = {
  es: {
    profile: 'Perfil: [1] universal (lo imprescindible) o [2] abm-estricto (añade las plantillas de ABMS). Enter = 1: ',
    assistants: `Asistentes, separados por comas (${ASSISTANTS.join(', ')}). Enter = todos: `,
    seo: '¿Es una web que quiere el pack de SEO? (s/N): ',
    ci: '¿Escribo también .github/workflows/abmh-ci.yml? (s/N): ',
    docs: 'Ya existe 00-docs. Carpeta para los docs del arnés (Enter = 00-docs): ',
    retry: 'No entiendo esa respuesta, prueba otra vez.',
  },
  en: {
    profile: 'Profile: [1] universal (the essentials) or [2] abm-estricto (adds the ABMS templates). Enter = 1: ',
    assistants: `Assistants, comma separated (${ASSISTANTS.join(', ')}). Enter = all: `,
    seo: 'Is this a website that wants the SEO pack? (y/N): ',
    ci: 'Also write .github/workflows/abmh-ci.yml? (y/N): ',
    docs: '00-docs already exists. Folder for the harness docs (Enter = 00-docs): ',
    retry: 'I did not understand that answer, try again.',
  },
}

const given = (argv, flag) => argv.some((arg) => arg === flag || arg.startsWith(`${flag}=`))

const valueOf = (argv, flag) => {
  const inline = argv.find((arg) => arg.startsWith(`${flag}=`))
  if (inline) return inline.slice(flag.length + 1)
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] : undefined
}

export function needsInterview(argv, { stdinTTY, stdoutTTY }) {
  return argv[0] === 'init' && stdinTTY === true && stdoutTTY === true && !given(argv, '--accept-plan') && !given(argv, '--yes')
}

async function askValid(ask, question, parse, retry) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const result = parse((await ask(question)).trim())
    if (result !== undefined) return result
    console.log(retry)
  }
  return null
}

const parseProfile = (answer) => ({ '': null, 1: null, universal: null, 2: 'abm-estricto', 'abm-estricto': 'abm-estricto' })[answer]

function parseAssistants(answer) {
  if (answer === '') return null
  const wanted = answer.split(',').map((name) => name.trim()).filter(Boolean)
  return wanted.length > 0 && wanted.every((name) => ASSISTANTS.includes(name)) ? wanted.join(',') : undefined
}

export async function interview(argv, ask) {
  const lang = TEXT[valueOf(argv, '--lang')] ?? TEXT.es
  const flags = []
  if (!given(argv, '--profile')) {
    const profile = await askValid(ask, lang.profile, parseProfile, lang.retry)
    if (profile) flags.push('--profile', profile)
  }
  if (!given(argv, '--assistants')) {
    const assistants = await askValid(ask, lang.assistants, parseAssistants, lang.retry)
    if (assistants) flags.push('--assistants', assistants)
  }
  if (!given(argv, '--packs') && YES.test((await ask(lang.seo)).trim())) flags.push('--packs', 'seo')
  if (!given(argv, '--ci') && YES.test((await ask(lang.ci)).trim())) flags.push('--ci')
  const root = path.resolve(valueOf(argv, '--root') ?? process.cwd())
  if (!given(argv, '--docs-dir') && fs.existsSync(path.join(root, '00-docs'))) {
    const folder = await askValid(ask, lang.docs, (answer) => {
      if (answer === '' || answer === '00-docs') return null
      try {
        return parseDocsDir(answer)
      } catch {
        return undefined
      }
    }, lang.retry)
    if (folder) flags.push('--docs-dir', folder)
  }
  return flags
}
