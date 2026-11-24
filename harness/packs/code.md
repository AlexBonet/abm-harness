# Pack: code

> **Summary:** rules every project's code follows, always strict. Each rule has an id and a named check; `{{ABMH}}checks/check.sh prueba` runs them and reports PASS, FAIL or NOT RUN per id.
> The stack packs (`code-kotlin`, `code-astro-react`) give the checks their syntax; with no stack installed the stack-bound checks report NOT RUN.

| id | rule | check | type | gate |
| --- | --- | --- | --- | --- |
| COD-01 | Domain code imports no framework, database or UI | cod-01.sh | script | Prueba |
| COD-02 | No source file has more than 300 lines | cod-02.sh | script | Prueba |
| COD-03 | No code comments (tool directives allowed) | cod-03.sh | script | Prueba |
| COD-04 | No `any` / `Any` types | cod-04.sh | script | Prueba |
| COD-05 | No UI text outside the i18n resources | cod-05.sh | script | Prueba |
| COD-06 | No top-level function signature repeated in two files | cod-06.sh | script | Prueba |
| COD-07 | Changed source comes with a changed test | cod-07.sh | script | Prueba |
| COD-08 | The pre-push hook is active | cod-08.sh | hook | Prueba |
| COD-10 | A changed file keeps its line endings (no CRLF to LF or back) | cod-10.sh | script | Prueba |

## Settings

- `domain_dir` in `{{ABMH}}harness.yaml`: the domain folder when it is not called `domain`.
- `ui-allowlist.txt` in the docs folder: files COD-05 skips, one path per line.
- `ABMH_BASE`: the git revision COD-07 and COD-10 compare against (default `HEAD`, so it sees uncommitted work only). After committing, or in CI, set it to the branch base, for example the merge-base with the main branch.
- `web_syntax: true` in the active harness configuration opts Astro/React COD-02/03/04/05 into syntax-aware detection; other stacks and unconfigured projects keep their existing checks. It requires Node, the project's TypeScript, and its Astro compiler for `.astro` files; analysis failures block the gate.
- `generated_sources` names an optional UTF-8 manifest for those opted-in checks only: one root-relative exact file or directory ending in `/`, followed by `|` and a reason. No globs, traversal or blanket test exemption. Review each entry; missing build output is allowed. Generated paths do not exempt other rules.
- Syntax-aware UI detection checks JSX/Astro text and literal `alt`, `title`, `placeholder` and `aria-label` values. It preserves the test/UI allowlist policy and does not infer arbitrary runtime strings, translations or text assembled in expressions.

## Waiting for an agent

No script can judge these; they stay out until an agent check exists:

- Identifiers, variables, functions and file names in English (baseline rule 6).
- Small functions, self-explanatory names, SOLID (rules 2 and 3).
- DRY beyond top-level signatures, KISS and YAGNI (rules 4 and 5).
- Tests written before the code.
