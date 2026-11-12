# TASK-NNN — {Title}

> Task descriptor. Holds business context, dependencies, acceptance criteria. One task may produce multiple prompts. State lives in Plane (when configured), this file is informative.

---

## Meta

- **ID:** TASK-NNN
- **Stack target:** {android | web | shared | none}
- **Status (informative):** {todo | in-progress | blocked | done}
- **Plane reference:** {Plane URL or ID, leave empty if not synced}
- **Related ADRs:** {ADR-001, ADR-005}
- **Related tasks:** {TASK-042 blocks this, TASK-051 supersedes this}
- **Generated prompts:** {PROMPT-093, PROMPT-094}
- **Created:** {YYYY-MM-DD}
- **Last updated:** {YYYY-MM-DD}

---

## 1. Goal

One paragraph. What this task achieves in business terms. Not implementation.

---

## 2. Background

Why this task exists. What problem it solves, what triggered it (client request, bug, refactor opportunity, deferred from another task).

Link any conversation, issue, or document that motivated it.

---

## 3. Scope

### In scope

- {explicit list of what is included}

### Out of scope

- {what is explicitly NOT included, even if it seems related}

---

## 4. Acceptance criteria

Measurable conditions. The task is done when all are true.

- [ ] {criterion 1}
- [ ] {criterion 2}
- [ ] {criterion 3}

---

## 5. Domain context

Anything from `PROJECT_CONTEXT.md` or `database/SCHEMA.md` the Coder needs to know. Quote, do not link, so the Coder gets it in the prompt.

- Entities involved: {list}
- Business rules: {list}
- Cross-cutting concerns: {RLS, multi-tenant, i18n}

---

## 6. Implementation hints (optional)

If there is a known pattern in the repo or a constraint that is not obvious, note it here. Do not write code. Do not over-prescribe — let the Coder choose the implementation.

---

## 7. Risks

- {what could go wrong}
- {what is fragile}

---

## 8. Definition of Done

Beyond acceptance criteria, anything else that must hold:

- [ ] No file over 300 lines
- [ ] No hardcoded strings (i18n verified)
- [ ] Tests added or updated as needed
- [ ] Migration applied (if database change)
- [ ] Reported back to SCRUM with summary

---

**Template version:** v1.0