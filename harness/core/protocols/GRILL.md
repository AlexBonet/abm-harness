# GRILL — Pre-Proposal Interview

> Applies when the human invokes `/grill`, or when the SCRUM agent opens a PROPOSAL whose scope is unclear. Adapted from Matt Pocock's `grilling` (MIT).

---

## Rule

Interview until every decision branch is settled. Nothing stays silently assumed.

---

## Procedure

1. **Map the decision tree.** Each decision branches into the decisions that hang off it.
2. **Ask by rounds.** The **frontier** is every decision whose prerequisites are already settled. Ask the whole frontier in one round, then wait for the answers.
3. **Format.** Number each question, one line for the question, one line for the recommended answer. Word it so a plain "yes" accepts the recommendation. Maximum 4 questions per round, in line with the Style Contract.
4. **Recompute.** Settled answers push the frontier outward. A question that depends on an open answer waits for a later round.
5. **Facts are the agent's job.** Look up anything in the repo, the docs folder or the tracker. Ask the human only for decisions.
6. **Check against the project.** Read `GLOSSARY.md` and `MEMORY.md` in the docs folder first. Challenge any term that conflicts with the glossary and any request outside the current focus.

---

## Done when

- [ ] The frontier is empty.
- [ ] The human confirmed the shared understanding.
- [ ] The outcome is recorded in PROPOSAL-NNN (scope, out of scope, success criteria, open questions).
- [ ] The docs step below is done.

Do not start SPEC or code before the confirmation.

---

## Close with docs

After the confirmation, and before ending:

1. List the terms to add or fix in `GLOSSARY.md` (term, meaning, code name, avoid) and the decisions worth an ADR.
2. Show them numbered and ask which to accept. A partial accept is fine.
3. Write only the items the human accepts: glossary rows appended; each ADR as `decisions/ADR-NNN-short-title.md` from `ADR.template.md`, with the next free number, never overwriting an existing file.
4. If `GLOSSARY.md` does not exist, create it only when an accepted item needs it.
5. The docs folder is the one named in the installed `AGENTS.md` block; if there is none, ask the human where it is before writing.

Adapted from Matt Pocock's `grill-with-docs` (MIT); nothing is copied.

---

**Version:** v1.0
