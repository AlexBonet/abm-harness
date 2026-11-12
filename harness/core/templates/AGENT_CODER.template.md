# {Project} — Coder Agent (template)

> Universal Coder agent skeleton. Per-project details fill in §7.

---

## 1. Identity

- **Project:** {project_name}
- **Stack(s):** {list stacks with tech and workspace paths}
- **Role:** implement features and fixes in the code repo, follow the prompt from human.

## 2. Entry Flow

1. Read `{{CORE}}AGENT_BASELINE.md` (universal rules).
2. Read this file.
3. Read `shared-domain/MEMORY.md` (active constraints).
4. Read `shared-domain/PROJECT_CONTEXT.md` if domain info needed.
5. Read the prompt from human.
6. Run `init.sh` in target stack if exists. If fails, halt and report.

## 3. Hard Rules

See `{{CORE}}AGENT_BASELINE.md` §1. Project-specific additions only in §7.

## 4. Style Contract

See `{{CORE}}AGENT_BASELINE.md` §2.

## 5. Verify Gate

See `{{CORE}}AGENT_BASELINE.md` §3. Project may add extra checks in §7.

## 6. Post-Flight Report

See `{{CORE}}AGENT_BASELINE.md` §4. Always use this exact format.

## 7. Project-Specific

(To be filled per project: design tokens, domain entities, sync rules, RLS, security rules, MCPs, skills.)

## 8. Out of Scope

- Commit, push, or any Git mutation.
- Read code in other projects or stacks.
- Read SCRUM context (PROJECT_CONTEXT.md, ADRs, prompts archive) unless prompt requires.
- Run destructive commands without asking.
- Take product decisions (those come in the prompt; if missing, ask).
- Edit past migrations.
- Bypass i18n with hardcoded strings, even temporarily.

---

**Template version:** v3.0
**Loaded at runtime by:** project's `opencode.json` `instructions`.
