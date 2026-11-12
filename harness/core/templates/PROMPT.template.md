# PROMPT-NNN — {Title}

> Actionable prompt for the Coder agent. Originates from a TASK. Contains everything the Coder needs to execute — no more, no less. The human copies this into the Coder's OpenCode session.

---

## Meta

- **ID:** PROMPT-NNN
- **Stack target:** {android | web | shared}
- **Origin task:** TASK-NNN
- **Related ADRs:** {ADR-001, ADR-005}
- **Created:** {YYYY-MM-DD}

---

## 1. Goal

One sentence. What the Coder must deliver by the end of the session.

---

## 2. Context

Domain and business context the Coder cannot infer from code alone. Quote relevant sections from `PROJECT_CONTEXT.md` or `SCHEMA.md` — do not link, include inline.

- **Entities involved:** {list with key fields}
- **Business rules:** {list the rules that affect implementation}
- **Cross-cutting concerns:** {RLS, multi-tenant, i18n, etc.}

---

## 3. Scope

### In scope

- {explicit list of what must be implemented}

### Out of scope

- {what is explicitly NOT included, even if it seems related}

---

## 4. Files likely affected

List modules, packages, or files the Coder will probably touch. Not exhaustive — directional.

- `{path/to/file.ext}` — {why}
- `{path/to/other.ext}` — {why}

---

## 5. Acceptance criteria

Measurable conditions. The task is DONE when ALL are true and `verify.sh` passes.

- [ ] {criterion 1 — observable, testable}
- [ ] {criterion 2}
- [ ] {criterion 3}
- [ ] `verify.sh` exits with code 0

---

## 6. Implementation notes

Optional. Known patterns in the repo, constraints that are not obvious, or ADRs that dictate approach. Do not write code here. Do not over-prescribe.

---

## 7. Risks and edge cases

- {what could go wrong during implementation}
- {edge cases the Coder should handle or flag}

---

**Template version:** v1.0