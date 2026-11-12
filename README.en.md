# abm-harness

Installs the ABMH harness (working rules, templates, protocols, skills and review agents) into any project, **inside that project**. It first shows you a plan and writes nothing; it installs only if you accept that exact plan.

Español: [README.md](README.md)

## Quick start

You need Node 20 or newer, git and pnpm. In your project's root:

```sh
pnpm dlx github:AlexBonet/abm-harness#v0.1.0 init                      # shows the plan; writes nothing
pnpm dlx github:AlexBonet/abm-harness#v0.1.0 init --accept-plan <id>   # installs exactly that plan
pnpm dlx github:AlexBonet/abm-harness#v0.1.0 update                    # plan to update; accepted the same way
pnpm dlx github:AlexBonet/abm-harness#v0.1.0 doctor                    # checks the install; changes nothing
pnpm dlx github:AlexBonet/abm-harness#v0.1.0 remove                    # plan to remove what it installed
```

`remove` leaves the project as it was. MIT licence (`LICENSE`, `NOTICES.md`).

## What it is and what it is not

- A small installer (one Node script, no dependencies) with five commands: `init`, `update`, `remove`, `doctor` and `migrate` (the last one only moves `shared-domain/` to `00-docs/`).
- It touches nothing outside the project (except the backup made by `migrate`), never reads or writes `.env`, and never commits or pushes.
- It does not install the Claude Code mods (Cabina, Guardia, Migraciones). Rules are enforced by a git hook and by instructions.
- It never uses npm or npx. If you need a package manager, use pnpm.

## What it installs for day-to-day work

- `.abmh/lanes/`: 6 lanes (Consulta, Cambio, short SPEC, SDD, Bug, Deploy). Risk is measured first, then the lane is chosen; the always-SDD list overrides any lane.
- `.abmh/gates/`: 6 gates (test, review, design, SEO, security, release).
- `.abmh/packs/` and `.abmh/checks/`: rule packs (code, communication and memory, security, plus one per detected stack — Kotlin or Astro/React — the migrations and data pack when a migrations folder exists, the deploy pack always and the design pack when an interface exists; the web SEO pack only on request). Each rule has an id and an `.sh` script that checks it; `sh .abmh/checks/check.sh prueba`, `seguridad`, `despliegue`, `diseño` or `seo` prints PASS, FAIL or NOT RUN per rule. With no detected stack the project stays "pending" and `update --packs <id>` completes it.
- `.abmh/agents/`: 10 agent cards. The `abm-estricto` profile also adds `.abmh/strict.md` (pnpm, clean architecture, no comments).

## Install

You need Node 20 or newer and git. Once, download the repo:

```sh
git clone https://github.com/AlexBonet/abm-harness.git ~/abm-harness
```

Optional, to type less:

```sh
alias abmh='node ~/abm-harness/bin/abmh.mjs'
```

## Use it in a project

1. Go to the project **root** (the folder that contains `.git`):

   ```sh
   cd /path/to/your-project
   node ~/abm-harness/bin/abmh.mjs init
   ```

2. Read the plan. You will see something like this (nothing has been written yet):

   ```
   abmh init plan for /path/to/your-project
   plan id: c32bb855310e…
   [harness]
     create-file .abmh/core/ (34 files) - harness file
     create-file .abmh/skills/ (2 files) - harness file
   [claude]
     link .claude/skills/spec -> .abmh/skills/spec - expose to the assistant
   [instructions]
     block AGENTS.md - add the harness block to the existing file
   [hooks]
     config core.hooksPath=.abmh/hooks - run the harness git hook

   Nothing is written until you accept this exact plan:
     node ~/abm-harness/bin/abmh.mjs init --accept-plan c32bb855310e…
   ```

3. If it looks right, copy and run the last line (with the full id). That installs.

If the project changes between the plan and the acceptance, the installer refuses (`ABMH_PLAN_CHANGED`, exit 3), writes nothing and asks for a new plan.

## What gets written

| Where | What |
|---|---|
| `.abmh/` | A copy of the harness (`core/`, `skills/`, `agents/`, `hooks/`) `manifest.json` (the record of everything installed) and `harness.yaml` (version, profile and docs folder). |
| `00-docs/` | `LEEME.md`, `STATUS.md`, `MEMORY.md` and `GAPS.md`, each with `Audience:` and a 3-line summary (change the path with `--docs-dir`). |
| `00-docs/decisions/` | A guide and a template to record decisions. |
| `.claude/skills/`, `.claude/agents/` | Links to `.abmh/` for Claude Code. |
| `.agents/skills/` | Links to the skills in `.abmh/skills/` (all but `abms-spec-review`) for Codex, Gemini, Cursor and OpenCode. |
| `AGENTS.md` | A block between `<!-- abmh:start -->` and `<!-- abmh:end -->`. Created if missing. Whatever you already had is untouched. |
| `GEMINI.md` | The same block. Created with the default (all assistants); with `--assistants` without `gemini` it is not created. |
| `.git/config` | `core.hooksPath` pointing to `.abmh/hooks`, only if the repo has no hooks of its own. |

`harness.yaml` is written by the installer: to change the docs folder use `update --docs-dir`; to change profile, `remove` then `init`.

If a link cannot be created on your system, the file is copied instead. If a path already exists and is yours, it is skipped and the plan says so.

Commit `.abmh/` yourself if you want to share it with your team; the installer never does.

## `init` options

| Option | What it does |
|---|---|
| `--assistants claude,codex,gemini,cursor,opencode` | Which assistants to install for (default: all). |
| `--lang es` or `--lang en` | Language of "Resumen"/"Summary" and "En corto"/"In short" (default: Spanish). |
| `--ci` | `init` only: also writes `.github/workflows/abmh-ci.yml` (lint, types, tests and `verify.sh` with pnpm). Without it the plan only says the template exists. |
| `--packs code-kotlin`, `code-astro-react`, `data`, `design` or `seo` | Picks a stack, the migrations pack, the design pack or the web SEO pack the detection did not find, or completes a pending project with `update --packs`. |
| `--profile universal` or `--profile abm-estricto` | `universal` (default) installs the essentials; `abm-estricto` also adds the ABMS project templates. |
| `--docs-dir <folder>` | Docs root (default `00-docs`); decisions go in `<folder>/decisions/`. Also accepted by `update`. If a file about to be created already exists and is yours, the plan warns and proposes another path. |
| `--no-hooks` | Do not install the git hook. |
| `--yes` | `init` only: skip the questions even on a terminal. |
| `--root <folder>` | Install into another folder; use it when you are not at the repo root. |
| `--accept-plan <id>` | Apply the plan with that id. |

Running `init` again on an installed project changes nothing.

On a terminal, `init` asks what it cannot detect (profile, assistants, the SEO pack, the CI file and, if `00-docs` already exists, another docs folder), only for what you did not give as an option; then it shows the plan as usual. Without a terminal (a script, a CI) or with `--yes` it never asks.

## Update and remove

```sh
node ~/abm-harness/bin/abmh.mjs update     # shows a new plan; accept it like init
node ~/abm-harness/bin/abmh.mjs remove     # shows what it would remove; accept with its id
```

- `update` never overwrites files you edited by hand: it skips and lists them.
- An older install that used `docs/decisions/` is migrated by `update`: it creates the new folder, deletes from the old one only what the installer created and you did not touch, and lists what stays where it was. It never moves your files.
- `remove` deletes only what the manifest says it installed and that is still unchanged. Whatever you edited stays and is listed. If the installer created `AGENTS.md` and it holds only the block, the file is deleted; otherwise only the block is cut out.
- If an install is cut short, `init` prints the id to resume it, and `remove` still works.

## Migrating `shared-domain/` to `00-docs/`

For a project that already has `shared-domain/`:

```sh
node ~/abm-harness/bin/abmh.mjs migrate
```

It prints a plan (what is renamed, which files change text and how many times) and writes nothing. Accepting it with `--accept-plan <id>` does this, in order:

1. Saves a `.tar.gz` copy and a `.json` record in `<parent folder of the project>/_backups/` (another folder with `--backup-dir`; never inside the project). This is the only thing written outside the project.
2. Renames `shared-domain/` to `00-docs/`.
3. Replaces the text `shared-domain/` with `00-docs/` in `.md .json .yaml .yml .sh .ts .js` files. It skips `node_modules`, `.git`, `.abmh`, `.env*`, symbolic links, binaries and files over 1 MB. It deletes nothing.

To go back: `migrate --restore <copy.tar.gz>` prints a plan; accepting it moves the current `00-docs/` aside as `00-docs.restored-<date>/` (it is not deleted) and extracts the copy. If `00-docs/` already exists with content or `shared-domain/` is missing, it refuses without writing. Inside a larger repo, pass `--root <folder>`.

## Checking the install (`doctor`)

`abmh doctor` changes nothing in the project (it only uses temporary files outside it and deletes them). It prints one line per check (`OK`, `FAIL` or `NOT RUN`) and, for each `FAIL`, how to fix it. A check that could not run never shows as OK.

| Id | What it looks at |
|---|---|
| D1 | valid manifest and harness version up to date |
| D2 | harness files, links and the `AGENTS.md` block untouched or lost (`harness.yaml` and your docs may be edited) |
| D3 | git hook installed in this clone; with husky or another hook manager it is NOT RUN and the CI is the only barrier |
| D4 | packs in `harness.yaml` equal the installed ones; no detected stack is NOT RUN |
| D5 | `LEEME`, `STATUS`, `MEMORY`, `GAPS` and `decisions/` exist |
| SEC, DEP | result of `check.sh seguridad` and `check.sh despliegue` (an unfilled `RELEASE.md` or `RECOVERY.md` is FAIL) |

`doctor` exit: 0 all OK · 1 any FAIL · 2 only NOT RUN.

## Exit codes

0 ok · 2 bad usage · 3 the plan changed · 4 refused for safety or conflict · 5 apply failed.

## Skills

The core is eight. Five travel with the harness and install like `spec`: `spec`, `abms-spec-review`, `grill`, `wizard` and `diagnose`. Three belong to Claude Code and are only named, never copied: `code-review`, `simplify` and `security-review`.

- Golden rule: a skill enters only if it replaces another or fixes a measured failure. Growing the core is a human decision and an edit of `tests/skills.test.mjs`.
- `grill` and `wizard` are marked so Claude Code never invokes them on its own, and their text says to use them only when asked by name; `diagnose` may be invoked. `grill` ends by offering glossary terms and decision records, and writes only what the human accepts.
- Packs, named and not installed: web (`impeccable`, `landing`, `design:accessibility-review`, `design:design-system`) and deploy (`wrangler`, `workers-best-practices`, `web-perf`, `engineering:deploy-checklist`).
- Third-party skills are only absorbed as ideas, with source and licence in the file header.

## Known limits

- Some templates and the `spec` skill keep examples and paths designed for the ABMS system (for example `PROJECT_CONTEXT.md` and `specs/`). They work as a guide, but in a foreign project they may not apply as written.
- The `abms-spec-review` skill and the review agents are linked for Claude Code only, because they need Claude subagents.
- If something fails, do not delete by hand: run `remove`.
- With husky or another hook manager, `init` does not install the git hook (it never overrides yours): the secret scan runs only in the CI. `doctor` says so.
- If the project ignores `.claude/skills/` or `.agents/skills/` in its `.gitignore`, the skill links exist in your copy but are not shared through git.
- `RELEASE.md` and `RECOVERY.md` are installed unfilled: the deploy rules fail until you complete them.
- Windows and monorepos are untested.

## Development

`harness/` is the source of the harness. `sh scripts/verify.sh` checks everything: repo rules, tests and, when the repo sits inside a working tree that consumes it, that `node scripts/sync.mjs --check` matches; without such a tree that check reports NOT RUN (never OK) and the rest goes on.

## Licence

MIT, see `LICENSE`. Ideas taken from third parties, with their source and licence, are in `NOTICES.md`.
