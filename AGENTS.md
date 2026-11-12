# abm-harness

> Installs the ABMH harness into any project: plan first, accept by id, everything inside the project.

Read first: `harness/core/AGENT_BASELINE.md` (the universal working rules this repo ships).

## Rules for this repo

- JavaScript `.mjs`, zero runtime dependencies, Node >= 20. No code comments, files <= 300 lines.
- Never run the banned package runners; use pnpm. `scripts/verify.sh` fails if a script calls them.
- `harness/` is the source of the harness (tokens `{{CORE}}`, `{{OWNER}}`, `{{SUMMARY}}`, `{{ASK_OWNER}}`). Edit it here and run `node scripts/sync.mjs` to regenerate `harness/VERSION` and the copy of the harness that a parent working tree keeps (the maintainer's setup; without one, `sync --check` reports NOT RUN). Never edit generated copies by hand.
- Verify gate: `sh scripts/verify.sh` (banned runner scan, size, comments, portability scan, `sync --check` against the root, tests).
- Git: new branches only, commits only when the human asks, no push.

## Layout

- `bin/abmh.mjs` entry; `src/` (`cli`, `plan`, `apply`, `remove`, `doctor`, `doctoritems`, `interview`, `migrate`, `profiles`, `settings`, `render`, `docsscan`, `docsmove`, `backup`), `scripts/sync.mjs`, `tests/`.
- Profiles: `harness/profiles.json` lists what only `abm-estricto` adds (templates and `strict.md`); `universal` is the default.
- Lanes, gates and agent cards: `harness/lanes/`, `gates/`, `agents/` (cards are the files without the `abms-review-` prefix). Pointers use `{{ABMH}}` (`.abmh/` in an installed project, the parent working tree's own folder in the maintainer's setup). Each file at most 60 lines; `tests/lanes.test.mjs` checks them.
- Rule packs: `harness/packs/*.md` (tables `id | rule | check | type | gate`), `harness/checks/*.sh` (POSIX sh, exit 0 pass, 1 fail, 2 NOT RUN; stack settings in `checks/stack/`) and `harness/packs.json` (which files belong to which pack; install-only; kinds `always`, `stack`, `detect` for `data` and `design`, `optional` for `seo`, `profile`; `init --ci` also writes the CI workflow template from `harness/ci/`). `pre-push` runs SEC-01 for every pusher. Scripts: no comments, at most 120 lines, never call the banned runners; the suites `runner`, `cod`, `comms`, `data`, `security`, `deploy`, `design`, `seo`, `packs` and `packslife` in `tests/` check them.
- Installed result in a project: `.abmh/` with `manifest.json` and `harness.yaml`, links in `.claude/` and `.agents/`, a block in `AGENTS.md` (and `GEMINI.md`), a docs root (`00-docs/` by default: `LEEME`, `STATUS`, `MEMORY`, `GAPS` and `decisions/`).
- `abmh migrate` renames a project's `shared-domain/` to `00-docs/` with a plan, a backup `.tar.gz` outside the project and `--restore`. It never deletes; it is the only command that writes outside the project root (the backup).
