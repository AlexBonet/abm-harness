# MEMORY — {PROJECT_NAME}

> **Summary:** what the next agent must know before working here. A curated note, not a diary: prune on every review. Cap: 8 KB. Entries older than the current milestone move to `MEMORY-HISTORY.md`.
>
> Audience: agent · Last reviewed: {YYYY-MM-DD}

---

## Rules for this file

1. **Curate, do not append forever.** When a fact stops being true or useful, delete it or move it to `MEMORY-HISTORY.md`.
2. **Cap 8 KB.** Over the cap: move the oldest session entries and resolved backfires to `MEMORY-HISTORY.md` before adding anything.
3. **One line per fact**, with a date and a link when a decision or ADR exists (`[[decisions/ADR-NNN]]`).
4. **Not here:** product definition (`PROJECT_CONTEXT.md`), open questions (`GAPS.md`), state (`STATUS.md`).

---

## 1. Project identity

- **Project:** {PROJECT_NAME}
- **Stack:** {android, web, shared}
- **Database:** {Supabase / Firebase / none}
- **Last calibrated:** {YYYY-MM-DD}

---

## 2. Key decisions

|Date|Decision|Why|ADR|
|---|---|---|---|
|{YYYY-MM-DD}|{one line}|{why}|{ADR-NNN or "none"}|

---

## 3. Backfires

Things that went wrong and must not repeat. The most valuable section.

|Date|What happened|Root cause|Avoidance|
|---|---|---|---|
|{YYYY-MM-DD}|{what}|{why}|{what to do instead}|

---

## 4. Discoveries and stack knowledge

Non-obvious facts that would take time to rediscover.

|Date|Fact|Where|Impact|
|---|---|---|---|
|{YYYY-MM-DD}|{fact}|{file or area}|{how it affects work}|

---

## 5. Preferences

- **{Preference}:** {e.g. "Commit messages in Spanish"}

---

## 6. Active context

Replace this section when the context changes. Keep it to four lines.

- **Current focus:** {what is being worked on}
- **Blocking issue:** {or "none"}
- **Next step:** {what the next session does first}
- **Pending decisions for {{OWNER}}:** {DD-MM-YYYY question, or "none"}

---

**Template version:** v2.0 (curated, 8 KB cap; replaces the append-only v1.1)
