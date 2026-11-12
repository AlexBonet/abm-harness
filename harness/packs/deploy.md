# Pack: deploy

> **Summary:** how a release is checked, approved and made reversible. Each rule has an id and a named check; `{{ABMH}}checks/check.sh despliegue` runs them and reports PASS, FAIL or NOT RUN per id.

| id | rule | check | type | gate |
| --- | --- | --- | --- | --- |
| DEP-01 | A CI workflow runs lint, types, tests and `verify.sh` | dep-01.sh | script | Despliegue |
| DEP-02 | `RELEASE.md` in the docs folder says what the change touches, what could break, the rollback and the post-check | dep-02.sh | script | Despliegue |
| DEP-03 | `RECOVERY.md` in the docs folder says how to contain, check health and restore | dep-03.sh | script | Despliegue |
| DEP-04 | A project that declares `web: true` also declares `staging:` | dep-04.sh | script | Despliegue |

## Settings

- `web: true` and `staging:` in `{{ABMH}}harness.yaml`, written by hand: a web project says where its staging copy lives. Without `web: true`, DEP-04 reports NOT RUN.
- `RELEASE.md` and `RECOVERY.md` are installed unfilled, so DEP-02 and DEP-03 FAIL until a person fills the lines that start with `<`. The labels stay in English.
- DEP-01 reads `.github/workflows` and looks for lint, a type check, test and `verify.sh` as whole words in the steps, ignoring comments, `name:`, `runs-on:` and job keys. It never runs CI: a real run is judged by the Despliegue gate and the Reviewer. `abmh init --ci` writes a starting workflow, only when the human asks.

## Waiting for an agent

No script can judge these; they stay out until an agent check exists:

- The human's exact OK for each cloud write (baseline rule 16).
- A high-risk release waits for the human even when CI is green.
- Dependency and version triage: vulnerabilities and release notes.
