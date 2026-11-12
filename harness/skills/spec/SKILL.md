---
name: spec
description: Start, create or define a SPEC for any ABMS project. Use whenever the user says they want to start a spec, define a feature before building it, or turn an idea or PROPOSAL into a specification. Interviews the user in Spanish, then writes SPEC-NNN in English with a short Spanish summary on top.
---

# Spec Generator

Goal: the user answers a few easy questions and ends with a SPEC the Coder can build without inventing anything. The user does not read the whole SPEC, only the "{{SUMMARY}}".

Chat in Spanish. Everything written to files in English, except the "{{SUMMARY}}" block, which is Spanish.

## 1. Prepare (no questions yet)

1. Identify the project. If it is not obvious from the working directory or the request, ask once.
2. Read, in this order, what exists: `PROJECT_CONTEXT.md` in the docs folder, `MEMORY.md`, `GLOSSARY.md`, `GAPS.md` (an open gap this spec depends on becomes a question), the PROPOSAL the spec comes from, `specs/` and `decisions/` (earlier SPECs and ADRs), and `{{CORE}}templates/SPEC.template.md`.
3. Facts are your job. Never ask the user something you can read in the repo, the docs folder or the tracker. Ask only for decisions.
4. Take the next free `SPEC-NNN` number. Numbers never reset.

## 2. Interview

- Rounds of at most 4 numbered questions. Each: one line for the question, one line for the recommended answer, worded so "sí" accepts it. Prefer closed options over open questions. Wait for the answers before the next round.
- Settled answers unlock the questions that depended on them. Do not ask them earlier.
- Challenge any term that conflicts with the glossary and any request outside the current focus.

Cover these, in this order, until nothing is silently assumed:

1. **Purpose and scope:** what is built, what is explicitly out.
2. **Actor, action, permissions:** who does what, from which starting state, with which role.
3. **Must keep working:** which earlier SPECs, ADRs or features are touched. Propose the list from what you read; ask only to confirm it.
4. **Security, auth and data:** anything that changes login, tokens, permissions, deletes or migrates data. Never decide these yourself. If the user did not ask for stricter or different behavior, it is not in the spec.
5. **Proof:** how the result is shown to work (command, API response, screenshot against a sketch) and what evidence is saved.
6. **Human-only decisions:** from the answers, list what the agent must stop and ask about during implementation.
7. **Rollback:** how to undo it if it fails once live, whether the data can be rolled back, and what to observe after deploy. Propose the answer from the stack (revert commit, redeploy, flag off); irreversible data changes go to the human-only decisions.
8. **Edge cases and errors:** only the ones that change behavior.

## 3. Write

1. Fill `SPEC.template.md` into `specs/SPEC-NNN-{slug}.md` in the docs folder. Keep it ≤ 8 KB; if it grows, propose splitting.
2. Every requirement must be testable. Every assumption you made while writing goes in "{{SUMMARY}}" under "Decisiones que tomó el agente" or in Open questions. Never hide one.
3. Write the "{{SUMMARY}}" LAST: Spanish, ≤ 10 lines, plain words, no jargon.
4. Anything the interview showed the project does not know and nobody answered goes to `GAPS.md` in the docs folder, not into the SPEC as an assumption.
5. Set `Status: draft`.

## 4. Close

Show the user only the "{{SUMMARY}}" and the file path. Ask: "¿Esto te encaja o cambio algo?". Apply changes and repeat. Set `Status: reviewed` only after the user confirms. Do not start design or code before that confirmation.

If the project has Reviewer agents, suggest running the spec review before `approved`.
