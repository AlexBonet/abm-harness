# SPEC-NNN — {Title}

> Short SPEC for the SPEC corta lane (`{{ABMH}}lanes/short-spec.md`). Says WHAT and how it is proven, nothing else. Straight to the point; aim for ≤ 8 KB, never over 16 KB.

---

## {{SUMMARY}} (español, lectura de 1 minuto)

- **Qué se construye:** {1 línea}
- **Qué NO se toca:** {1 línea}
- **Cómo se demuestra:** {1 línea}
- **Decisiones solo tuyas:** {lista corta o "ninguna"}
- **Si sale mal:** {cómo se vuelve atrás y cuánto cuesta}
- **Riesgo:** {bajo | medio | alto} — {por qué}

---

## Meta

- **ID:** SPEC-NNN
- **Status:** {draft | reviewed | approved | superseded}
- **Created:** {YYYY-MM-DD}

## 1. Goal and out of scope

{Two lines: what is built and why. Then what is explicitly not.}

## 2. Requirements

### FR-01: {name}

- **Given:** {precondition}
- **When:** {action}
- **Then:** {observable result}

## 3. Must keep working

|Earlier SPEC / ADR / feature|Behavior that must still hold|How it is checked|
|---|---|---|

## 4. Proof and rollback

- [ ] {acceptance item, maps to FR-NN}
- [ ] The final clean-context Reviewer verdict is APPROVED and records `Tier:`, `Diff:`, `Reviewer:` and `Round:`
- [ ] Verify Gate passes
- **Rollback:** {how to undo and how long it takes}

## 5. Human-only decisions

The agent stops and asks before changing auth or permissions, touching data, adding behavior not listed in §2, or contradicting §3.

## 6. Decision log

|Decision|Risk|Decided by|Where|
|---|---|---|---|

---

**Template version:** v1.0
