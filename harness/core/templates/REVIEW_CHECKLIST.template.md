> **DEPRECATED — This file is replaced by `AGENT_REVIEWER.template.md`.** Kept for compatibility during migration. Do not edit. New projects should use `AGENT_REVIEWER.template.md`.

# REVIEW_CHECKLIST — Coder Output Audit

> Mechanical checklist for the Reviewer agent. Every item must be checked. Every violation must be listed. The verdict is binary: APPROVED or REJECTED. There is no partial approval.

---

## Meta

- **Review of:** {TASK-NNN | PROMPT-NNN}
- **Coder:** {Coder Android | Coder Web}
- **Date:** {YYYY-MM-DD}
- **Diff ref:** {commit hash or "unstaged"}

---

## 1. Pre-review setup

Before starting the audit, the Reviewer MUST:

- [ ] Read `shared-domain/PROJECT_CONTEXT.md` in the active workspace
- [ ] Run `git diff` against the base branch or last accepted commit
- [ ] Run `./verify.sh` and capture exit code and full output
- [ ] Read the TASK/PROMPT that originated this change

If `PROJECT_CONTEXT.md` or `verify.sh` is missing, the review is REJECTED on procedural grounds.

---

## 2. Domain Purity (absolute — any violation = REJECT)

Check every file in the `domain/` path.

- [ ] No imports from `androidx.*`, `android.*`, `com.google.android.*`
- [ ] No imports from `react`, `astro`, `@astrojs/*`, `next/*`
- [ ] No imports from `io.supabase`, `@supabase/*`, `com.google.firebase`
- [ ] No imports from UI frameworks (Jetpack Compose, SwiftUI, etc.)
- [ ] No imports from database drivers (Room, SQLite, Supabase client)
- [ ] No I/O constructs (File, HttpClient, Context, SharedPreferences)
- [ ] No dependency on Data or Presentation layer

**If any domain file violates purity, the review is REJECTED. No exceptions.**

---

## 3. Architectural compliance

- [ ] **Dependency direction:** Domain → nothing. Data → Domain. Presentation → Domain (and Data via DI). No reverse arrows.
- [ ] **File length:** No file exceeds 300 lines.
- [ ] **Code language:** All identifiers, variables, functions, and file names in English. Spanish only in i18n string resources.
- [ ] **No `any` type** in TypeScript files. Reject on sight.
- [ ] **No code comments.** Code must be self-documenting. Reject if comments exist (i18n keys and license headers are exempt).
- [ ] **Multi-tenancy:** Every business entity references `organization_id`. No cross-tenant logic client-side.
- [ ] **Multi-table mutations:** Operations touching more than one table route through `SECURITY DEFINER` RPC. No chained client mutations.
- [ ] **i18n:** No hardcoded UI strings. All text through translation keys.
- [ ] **Migrations:** Schema changes are sequential `.sql` files. No edits to applied migrations. No raw DDL in application code.

---

## 4. TDD compliance (if strict TDD is active)

Check only when `PROJECT_CONTEXT.md` declares strict TDD or the TASK is not marked as `spike`.

- [ ] Every new implementation file has a corresponding test file
- [ ] Test files cover happy path and at least one edge case
- [ ] No implementation-only diffs without corresponding test changes
- [ ] Refactoring diffs preserve behavior (tests still pass after refactoring)

---

## 5. verify.sh gate

- [ ] `verify.sh` exits with code `0`
- [ ] If `verify.sh` is absent or broken, flag it: the harness is incomplete, and the review is REJECTED on procedural grounds

---

## 6. Functional correctness

Based on reading the diff and the originating TASK/PROMPT:

- [ ] The change implements what the TASK/PROMPT requested
- [ ] No out-of-scope changes were made (or they are flagged in the Coder's report)
- [ ] Error states are handled (loading, error, success visible in UI)
- [ ] Edge cases mentioned in the TASK/PROMPT are handled

---

## 7. Change risk assessment

|Metric|Value|
|---|---|
|Lines changed|{count}|
|Files changed|{count}|
|Layers touched|{Domain / Data / Presentation — list which}|
|New files created|{count}|
|Migrations included|{count}|
|Risk level|{low / medium / high}|

**Risk thresholds:**
- **Low:** < 150 lines, 1-3 files, single layer
- **Medium:** 150-400 lines, 4-8 files, 2 layers
- **High:** > 400 lines, > 8 files, 3 layers, or cross-cutting changes

If risk is HIGH, the Reviewer RECOMMENDS a delivery strategy (see DELIVERY_STRATEGY.template.md).

---

## 8. Verdict

### APPROVED

All checklist items pass. `verify.sh` exits 0. No domain purity violations. Architectural compliance met.

### REJECTED

One or more checklist items fail. List every violation with file, line, and rule broken.

---

## Verdict format

```
## VERDICT: APPROVED | REJECTED

### Evidence
- verify.sh exit code: {0|non-zero}
- Files changed: {count}
- Git diff summary: {1-line summary}

### Violations (only on REJECTED)
1. {file}:{line} — {rule broken} — {PROJECT_CONTEXT.md section}
2. ...

### Conclusion
{One sentence. If APPROVED, authorize merge/commit. If REJECTED, instruct the Coder to fix the listed violations and re-submit.}
```

---

**Template version:** v1.0