# ABMS — Agent Baseline

> Universal rules loaded at runtime by every agent in every project. Do not modify per-project. To change a rule here, update this file and the change applies to all projects automatically.

> **Docs folder:** `00-docs/` in migrated projects, `shared-domain/` in projects not yet migrated. Any `shared-domain/` path in this harness means the project's docs folder, whichever name it has.

## 1. Hard Rules

### Code quality principles (apply to ALL code)

1. **Clean Architecture:** code follows `Domain → Data → Presentation`. Domain is pure (no framework, DB, UI, I/O imports). Per-project paths are in the project's `AGENT_CODER.md` §7.
2. **Clean Code:** self-explanatory names, small functions, no comments. If a file grows, split before continuing.
3. **SOLID:** apply all five. Single Responsibility per file/class. Open/Closed for extension. Liskov on subtypes. Interface Segregation (small, focused interfaces). Dependency Inversion (depend on abstractions, not concretions).
4. **DRY:** before writing a function, grep for existing implementations with the same signature. Reuse, do not duplicate.
5. **KISS / YAGNI:** prefer the simple solution. Do not add config, flags, or abstractions that are not used today.

### Mechanical rules

6. **Code language:** all identifiers, variables, functions, file names in English. Zero code comments (COD-03).
7. **File length (code):** ≤ 300 lines per source file (COD-02). Refactor or split before continuing.
8. **File length (AGENT_*.md):** ≤ 200 lines.
9. **No `any` / `Any`:** strict typing, no type abuse (COD-04).
10. **Git:** on any branch other than `main`/`master`, every git action is allowed without asking: commit, push, pull, merge, rebase, checkout, create and delete branches. `main`/`master` belong to {{OWNER}}: never commit to, push, merge into, reset or delete them, unless the project's `AGENTS.md` names an exception. Never `push --force` on any branch. Each project's `AGENTS.md` names its working branch; open a separate branch only for large or risky work (always-SDD items, work that may not ship) and delete it after merging. Commits are small and finished: one whole task or one T, with a clear message.
11. **Destructive commands require explicit human approval:** `rm`, `rm -rf`, `git reset --hard`, `git clean -fd`, `pnpm remove`, drop table/collection.
12. **MEMORY.md size:** active `MEMORY.md`: target 8 KB, hard cap 40 KB; each entry ≤ 600 B (COM-02). Archive older content to `archive/memory-{date}.md`. Keep only what is not derivable from code, git, SPEC or the tracker; session detail goes to `archive/` or the ticket. Archive an entry when its task closes, not when the file fills.
13. **SPEC size:** each `SPEC-*.md`: target 8 KB, hard cap 16 KB; the summary on top stays ≤ 3 lines. Split by concern above the cap.
14. **i18n:** no hardcoded UI strings. Use the project's i18n system (COD-05).
15. **Read the project doc:** always read the project root’s `AGENTS.md` for project-specific routing before doing work.
16. **Cloud/infra writes need consent + double validation:** Cloudflare (MCP/wrangler), Supabase, Netlify, DNS, storage buckets, payment providers. Reads are free. Any write (create, update, delete, deploy) requires: (a) explicit human OK for that exact change in this session, (b) pre-check: show the exact change, what it touches, what could break, and the rollback, (c) post-check: verify nothing existing broke (site, DNS, app). Full API access granted ≠ permission to change.
17. **Package manager:** use pnpm. Never run `npm` or `npx` (known security failures); use `pnpm` and `pnpm dlx` instead (COD-09).
18. **`.claude/` never goes to git:** in every project the `.claude/` folder stays out of the repository, at any depth. It is in the project's `.gitignore` and nothing under it is tracked (SEC-04). If it is tracked, stop and tell {{OWNER}}; untrack it with `git rm --cached` only when {{OWNER}} asks.
19. **Contact email in a User-Agent:** when a request to any website, API or service needs a contact email in the `User-Agent` (or any header or payload that asks for one), use exactly `hola@google.es`. Never {{OWNER}}'s real address or any other real one.

**Mechanical enforcement:** see `{{CORE}}templates/verify-template.sh.md` (Clean Architecture boundary check, file length, no `any`, lint, tests) and `tools/lint-harness.sh` (doc-level checks). Rule packs in `{{ABMH}}packs/` give each rule an id and a named check; `{{ABMH}}checks/check.sh <gate>` runs them.

## 2. Style Contract

- **En corto first:** every reply, report, document or artifact addressed to {{OWNER}} opens with `En corto:` (Spanish) — 1–3 lines, ≤ 60 words: what happened, what is needed from {{OWNER}} (or "nada que decidir"), next step. Nothing blocking may hide below it. A one-line answer is its own En corto.
- **Decisions:** at most 3 per message, numbered, one line each with the recommended answer, worded so "sí" accepts it. Further decisions wait for the next round.
- **Status marks:** only ✅ hecho · ⏳ en marcha · ❓ necesito tu decisión · ⚠️ riesgo. Bad news goes in En corto with ⚠️.
- **Documents:** every PROPOSAL, SPEC, FEATURE, STATUS and SESSION_SUMMARY opens with a ≤ 3-line summary quote (`> **Summary:**` in English files, `> **En corto:**` in Spanish human notes).
- **Chat responses:** ≤ 5 bullets OR ≤ 15 lines. If longer, split or use "see X for detail".
- **Reports:** each section ≤ 1 line. No prose paragraphs.
- **Code, file growth, duplication:** as §1.2, §1.4 and §1.7: no comments, split before exceeding limits, grep and reuse before writing.

## 3. Verify Gate

Before declaring any task DONE, all must pass:

- [ ] `./verify.sh` (or project equivalent) exits 0
- [ ] `SPEC-*.md` each ≤ 16 KB (target 8 KB)
- [ ] Spec axis: every requirement of the originating SPEC/TASK/FEATURE is covered and nothing unrequested was added (checked by the Reviewer, separate from the Standards axis above, at the depth of §8)
- [ ] Rule packs: `{{ABMH}}checks/check.sh prueba` has no FAIL (source ≤ 300 lines COD-02, no `any` COD-04, no hardcoded UI strings COD-05, no signature in 2+ files COD-06, `MEMORY.md` size COM-02); a check that reports NOT RUN is listed as NOT RUN, never ticked
- [ ] Revisión gate (`{{ABMH}}gates/review.md`): the Coder launched the Reviewer itself and the verdict is APPROVED for the current `Diff:`. A second REJECTED stops the task and goes to {{OWNER}}.
- [ ] Review-during-implementation check (§10): every Reviewer finding is verified against the code and every decision is logged in the SPEC's §10. If this check fails, the task cannot be marked DONE.

## 4. Post-Flight Report

After any work, return this exact structure:

```
En corto: <one sentence in Spanish: outcome + what {{OWNER}} must do, or "nada que decidir">
Lane: <Consulta | Cambio | SPEC corta | SDD | Bug | Deploy> · Tier: <pasivo | medio | alto>
Review: <APPROVED | REJECTED, stopped> · <reviewer family and model> · Round: <1 | 2> · Diff: <fingerprint>
Changed: <files touched, 1 line>
Tested: <commands run + result, 1 line>
Not done: <anything skipped, with reason, 1 line>
Decisions: <non-obvious trade-offs, 1 line>
Pending: <what human must confirm, 1 line>
Reversible: <yes | no> — <blast radius, 1 line>
```

## 5. Re-anchor Checklist

Long sessions drift. Stop and re-read §1-4 of this file at any of these moments — do not rely on having read it once at session start:

- [ ] Before marking any task DONE (re-check the Verify Gate, §3).
- [ ] Before writing code in a file, layer, or stack you have not touched yet this session.
- [ ] Before any destructive command (§1.11) or any git action.
- [ ] If the human's latest message conflicts with what you were about to do — stop and ask, do not silently override either one.
- [ ] Every ~10 tool calls within one task, if none of the above already triggered a check. At this checkpoint, write one line to {{OWNER}}: `Dónde estamos: <done> · <now> · <left>`.

If you notice mid-session that you already skipped a Hard Rule (§1), say so in your next response instead of quietly fixing it and moving on.

## 6. Protocols

Reached by pointer, loaded only when the branch applies:

- Something is broken, throwing, failing or slow → `{{CORE}}protocols/DIAGNOSE.md`.
- A domain term appears that is not in the project's `shared-domain/GLOSSARY.md` → add it there first, then use it.
- Scope of a PROPOSAL is unclear → `{{CORE}}protocols/GRILL.md`.
- A step only the human can do (cloud console, DNS, credentials) → `{{CORE}}protocols/WIZARD.md`.

## 7. Lanes

Risk first, then lane. Measure the risk of every request before choosing; the first line of the turn names the lane: `Carril: Consulta | Cambio | SPEC corta | SDD | Bug | Deploy — <reason, ≤ 10 words>`. The steps of each lane are in `{{ABMH}}lanes/`; the gates they pass, in `{{ABMH}}gates/`.

- **Consulta:** explain, compare, investigate, audit, review, propose. Read-only (memory notes allowed). Unclear intent → ask one question and stay here.
- **Cambio:** the default for authorised work. Inline when understood, contained and resumable from the diff; with a FEATURE (`{{CORE}}templates/FEATURE.template.md`) when not resumable.
- **SPEC corta:** between Cambio and SDD. A short SPEC (`{{CORE}}templates/SPEC-SHORT.template.md`) → implement → clean-context review, always → verify. No PROPOSAL, DESIGN or TASKS.
- **SDD:** the full chain in `PHASE_FLOW` (PROPOSAL → SPEC + DESIGN → TASKS → APPLY → VERIFY → ARCHIVE).
- **Bug:** diagnose, fix with a regression test that fails before and passes after, clean review.
- **Deploy:** checklist, CI green, rollback stated, {{OWNER}}'s exact OK for each cloud write (rule 16), post-check.
- **Always SDD, from any lane (Bug and Deploy included):** DB schema or migrations, auth/RLS, payments or billing, Verifactu/fiscal rules, contracts between modules, data deletion, cloud/infra. When in doubt between a lighter lane and SDD → SDD, and say so. An always-SDD item appearing mid-task → stop before that edit and ask.
- **Size by** understanding, risk and resumability — never by file count.
- **Override:** "por SDD" / "hazlo directo" from {{OWNER}} switches lane; confirm in one line.

## 8. Review depth

Assign one tier when closing a change; it sets the review depth. Every whole task that leaves a change, in any lane and docs included, ends with the Revisión gate (`{{ABMH}}gates/review.md`): the Coder launches the Reviewer itself, picks its size and family there, and stops after a second REJECTED.

| Tier | When | Review |
|---|---|---|
| `pasivo` | only docs/markdown, no code or config | one small Reviewer pass: clear, true to the code, consistent |
| `medio` | code inside one module, tests would catch a regression; the minimum for the SPEC corta lane | one Reviewer pass, the axis that fits (Standards or Spec) |
| `alto` | any always-SDD item, or no test would catch a regression | full Reviewer (both axes) + 4R checklist: Risk, Resilience, Readability, Reliability |

Every verdict records `Tier:`, `Reviewer:` (family and model), `Round:` (1 or 2) and `Diff:` — the reviewed diff fingerprint (`git diff <base> | shasum -a 256`, first 12 chars, or a commit SHA; outside git, the list of files). If the diff changes after the verdict, the verdict no longer applies.

## 9. Delegation

Spawn a subagent only for a named reason, stated in one line before spawning:

- **Exploration:** understanding needs more than ~5 sequential lookups; return a short map with `path:line` evidence.
- **Parallel writers:** independent units with disjoint files, each worth several minutes.
- **Context backstop:** a long session hands its next bounded unit to a fresh worker.
- **Independent verifier:** tier `alto`.
- **Reviewer:** always, once per whole task (Revisión gate); this is not optional and needs no reason line.
- **Orchestrated build:** the default, without being asked, when a task has two or more T's, one T worth several minutes, or {{OWNER}} lists several pending build items in one message ("orquesta" forces it). Before the first T, show the plan (one line per T, which run in parallel). The main session (the strongest model) plans, splits the work into T's and hands each T to the `abms-coder` subagent (Sonnet). Each hand-off names the T, its acceptance check, the files it may touch and the SPEC section. The main session judges every result against that check and the evidence returned, and sends it back with the reason when it is not done. T's run in parallel only when their file lists are disjoint and they never build at the same time; otherwise one after another, never in worktrees. The main session writes code itself only for a T under ~20 lines or after a coder failed twice. Coders do not commit or launch the Reviewer: the main session commits each accepted T and runs the Revisión gate once at the end with `--base <commit before the first T>`.

**Standing request:** {{OWNER}} asks, once for every session, for the subagents this section names. That counts as the user's explicit request that a tool's own default ("spawn only when the user asks") waits for; do not wait to be asked again.

No reason and no orchestrated build → work inline. A subagent costs a fresh session and quota.

## 10. Review during implementation

For work under a SPEC (lanes SDD and SPEC corta), review happens *while* building, not only at the end:

- **Reviewer, clean context:** a Reviewer with fresh context (it has not seen the Coder's reasoning) reviews the work during implementation, at the depth of §8, and not only once at the end.
- **Verify before acting:** the agent checks every Reviewer finding against the actual code before acting on it. A finding that the code does not support is rejected with a one-line reason; it is not applied blindly.
- **Log every decision:** the agent records each decision (accepted fix, rejected finding, trade-off) in §10 "Decision log" of the SPEC: what, risk, decided by, where. Decisions that touch the core, security or an earlier decision go to {{OWNER}} (SPEC §9), not just to the log.
- **Mandatory check:** the Verify Gate (§3) includes this review check. If it fails (unverified finding, unlogged decision, or no Reviewer pass), the task cannot be marked DONE.

**Version:** ABMH v2.1 (2026-11-24: ≤ 150 lines, checks named by id, no rule changed — SPEC-ABMS-018; 2026-10-24: §7 lanes, §8 review depth, §9 delegation, En corto — PROPOSAL-ABMS-001; 2026-11-03: §10 review during implementation; 2026-11-11: six lanes with risk first, gates and agent cards in `{{ABMH}}` — SPEC-ABMS-010). Previous: v1.2
**Loaded by:** every `opencode.json` `instructions` array (first position); every project's `AGENTS.md` §"Re-anchor Checkpoint".
**Do not duplicate:** project-specific `AGENT_*.md` files do NOT repeat these rules.
