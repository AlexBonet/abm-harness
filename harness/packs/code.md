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

## Settings

- `domain_dir` in `{{ABMH}}harness.yaml`: the domain folder when it is not called `domain`.
- `ui-allowlist.txt` in the docs folder: files COD-05 skips, one path per line.
- `ABMH_BASE`: the git revision COD-07 compares against (default `HEAD`, so it sees uncommitted work only). After committing, or in CI, set it to the branch base, for example the merge-base with the main branch.

## Waiting for an agent

No script can judge these; they stay out until an agent check exists:

- Identifiers, variables, functions and file names in English (baseline rule 6).
- Small functions, self-explanatory names, SOLID (rules 2 and 3).
- DRY beyond top-level signatures, KISS and YAGNI (rules 4 and 5).
- Tests written before the code.
