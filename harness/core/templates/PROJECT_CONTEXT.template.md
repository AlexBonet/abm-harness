# PROJECT CONTEXT — {PROJECT_NAME}

> Canonical product reference. The SCRUM agent reads this first. Updated when the product evolves. Append-only for major changes; sections may be edited.

---

## 1. Summary

**{PROJECT_NAME}** in one sentence: {ONE_SENTENCE}.

**Status:** {beta / production / MVP / maintenance}

**Stacks active:** {android, web, mobile-kmp, ...}

**Real client(s):** {names or "none yet"}

---

## 2. Problem and value

### Problem

{What problem does this product solve, in 2-3 sentences.}

### Value proposition

{Why this over alternatives. Bullet list of 3-5.}

---

## 3. Users and roles

|Role|Description|Access|
|---|---|---|
|{role}|{description}|{scope}|

---

## 4. Functional areas

High-level feature inventory. This is not exhaustive documentation, only the map.

- **{Area 1}** — {one-line summary}
- **{Area 2}** — {one-line summary}
- ...

For each area, link to the most relevant ADRs or tasks if they exist.

---

## 5. Architecture

### 5.1 Tech stack

|Layer|Technology|
|---|---|
|{layer}|{tech}|

### 5.2 Per-stack notes

#### {Stack 1, e.g., Android}

- Repo path (symlink): `code-{stack}/`
- Key libraries: {list}
- Persistence: {Room, etc.}
- Stack-specific constraints: {anything}

#### {Stack 2}

- ...

### 5.3 Architectural principles

- Clean Architecture (Domain → Data → Presentation)
- Multi-tenant via RLS at database level
- Mutations through `SECURITY DEFINER` RPCs when multi-table
- {other principles specific to this project}

---

## 6. Domain Model

This section is what the SCRUM uses to reason about the product. **Not SQL. Not exhaustive fields.** Entities, key relationships, business rules.

### 6.1 Entities

#### {EntityName}

- **Purpose:** {what it represents in the business}
- **Owned by:** {organization / customer / etc.}
- **Key relationships:** {who points to who}
- **Critical rules:** {RLS, ownership, soft-delete, immutability}

### 6.2 Cross-cutting rules

- Multi-tenancy: every entity belongs to an `organization_id`. RLS denies cross-tenant access.
- Soft-delete: {which entities support it}
- Audit: {what is tracked, e.g., `created_at`, `updated_at`}

---

## 7. External integrations

|Service|Purpose|Status|
|---|---|---|
|{service}|{purpose}|{active / planned}|

---

## 8. Constraints

### 8.1 Hard constraints (do not violate)

- {e.g., file length 300 lines, English only, no `any`, no hardcoded strings}

### 8.2 Soft constraints (prefer this)

- {e.g., optimistic UI, lazy-loading, etc.}

---

## 9. Glossary

|Term|Meaning|
|---|---|
|{term}|{definition in this project's context}|

---

## 10. Open questions / known gaps

Things the SCRUM should flag rather than guess:

- [ ] {question}
- [ ] {gap}

---

## 11. References

- Repository paths (via ABMS symlinks): `code-{stack}/`
- Database schema summary: `database/SCHEMA.md`
- Past decisions: `decisions/`
- Current state: `STATUS.md`
- External: {Plane project URL, Supabase project, deploy URL}

---

**Version:** v1.0 **Last updated:** {DATE}