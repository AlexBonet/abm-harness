# SPEC-NNN — {Title}

> Specification artifact. Reads the PROPOSAL and defines WHAT the system must do (behavior), not HOW (design). Serves as the contract between business intent and technical implementation. Aim for ≤ 8 KB, never over 16 KB; split if it grows.

---

## {{SUMMARY}} (español, lectura de 1 minuto)

> Written LAST, in Spanish, max 10 lines, no jargon. {{OWNER}} reads only this block to say "me encuadra" or "cambiar X". If the rest of the spec contradicts it, the spec is wrong.

- **Qué se construye:** {1 línea}
- **Qué podrá hacer el usuario:** {1 línea, con quién y con qué permisos}
- **Qué NO se toca:** {1 línea: lo que debe seguir funcionando}
- **Cómo se demuestra:** {1 línea: prueba y evidencia que quedará}
- **Decisiones solo tuyas:** {lista corta de lo que el agente NO puede decidir; si no hay, "ninguna"}
- **Decisiones que tomó el agente por su cuenta al redactar:** {lista corta o "ninguna"}
- **Si sale mal:** {1 línea: cómo se vuelve atrás y cuánto cuesta}
- **Riesgo:** {bajo | medio | alto} — {por qué, 1 línea}

---

## Meta

- **ID:** SPEC-NNN
- **Status:** {draft | reviewed | approved | superseded}
- **Origin proposal:** PROPOSAL-NNN
- **Related ADRs / specs:** {ADR-NNN, SPEC-NNN, ...}
- **Created:** {YYYY-MM-DD}

---

## 1. Overview

Two to three sentences. What this specification covers and why. Reference the proposal ID.

---

## 2. Actor, action and permissions

What the user can do with this feature. Nothing outside this table may be added by the agent.

|Actor|Starting conditions|Action|Required permission|
|---|---|---|---|
|{role}|{state before}|{what they do}|{role / RLS / scope}|

---

## 3. Functional requirements

Each requirement is numbered, testable, and traceable.

### FR-01: {requirement name}

- **Given:** {precondition}
- **When:** {action or event}
- **Then:** {expected outcome}
- **Priority:** {must | should | could}

### FR-02: {requirement name}

- **Given:** {precondition}
- **When:** {action or event}
- **Then:** {expected outcome}
- **Priority:** {must | should | could}

---

## 4. Non-functional requirements

### NFR-01: {concern, e.g., Performance}

- **Criterion:** {measurable threshold}
- **Context:** {when this applies}

### NFR-02: {concern, e.g., Security}

- **Criterion:** {measurable threshold}
- **Context:** {when this applies}

Security or auth behavior not written here is NOT permitted. Stricter is not "safer" if it was not asked for: raise it in §9.

---

## 5. Domain context

Quoted from `PROJECT_CONTEXT.md` and `SCHEMA.md` — do not link, include inline. The Coder receives this spec without access to shared-domain/.

- **Entities involved:** {list with key fields}
- **Business rules:** {list rules that constrain the implementation}
- **Cross-cutting concerns:** {RLS, multi-tenant, i18n, audit}
- **Database changes required:** {yes/no, and what entities/tables}

---

## 6. Must keep working

Behaviors, specs and decisions from earlier work that this change must not break. Filled by reading previous SPECs, ADRs and `MEMORY.md`, not from memory.

|Source (SPEC / ADR / feature)|Behavior that must still hold|How it is checked|
|---|---|---|
|{SPEC-NNN / ADR-NNN}|{behavior}|{test or command}|

---

## 7. Acceptance criteria and proof

Observable conditions. All must be true for the spec to be considered met.

- [ ] {criterion 1 — maps to FR-NN}
- [ ] {criterion 2}
- [ ] `verify.sh` passes with no violations

### Proof

|Criterion|How to demonstrate|Evidence left behind|
|---|---|---|
|{criterion}|{command, API response, screenshot vs sketch}|{file, log or report path}|

A mandatory check that fails blocks "done". A check that was not run is listed as NOT RUN, never omitted.

### Rollback and post-deploy check

How to undo this change if it fails after it is live, and how to see that it is failing. Fill every row; write "n/a" with a reason, never leave blank.

|Item|Answer|
|---|---|
|Rollback steps|{revert commit, redeploy previous version, feature flag off, restore backup}|
|Data safe to roll back?|{yes / no — migrations or deletes that cannot be undone are a §9 human-only decision}|
|Time to undo|{minutes}|
|Post-deploy check|{what to observe on the live version vs. the previous one: error rate, key flow, log}|
|Who decides to roll back|{agent / {{OWNER}}}|

---

## 8. Edge cases and out of scope

|Scenario|Expected behavior|
|---|---|
|{edge case or error}|{how the system responds}|

**Out of scope** (prevents scope creep):

- {item 1}
- {item 2}

---

## 9. Human-only decisions

The agent must stop and ask before doing any of these, whatever the tests say.

- Changing how authentication, tokens or permissions work
- Dropping, renaming or migrating data
- Adding behavior, steps or dependencies not listed in §2–§4
- Contradicting anything in §6
- {spec-specific item}

When a finding is low risk and local, the agent fixes it and logs it in §10. When it touches the core, security or an earlier decision, it asks.

---

## 10. Decision log (filled during implementation)

|Decision|Risk (low/med/high)|Decided by (agent/{{OWNER}})|Where|
|---|---|---|---|
|{what was decided}|{level}|{who}|{file or commit}|

---

## 11. Open questions

- [ ] {question that needs resolution before or during design}
- [ ] {assumption that needs validation}

---

**Template version:** v1.1
