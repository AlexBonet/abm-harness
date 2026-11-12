# Lane: SDD

> The full chain. First line of the turn: `Carril: SDD — <reason>`.

## Entry

- An always-SDD item: DB schema or migrations, auth/RLS, payments or billing, fiscal rules, contracts between modules, data deletion, cloud/infra.
- Any other work when in doubt, or when a short SPEC outgrew its lane.

## Steps

1. PROPOSAL, then SPEC and DESIGN, then TASKS, APPLY, VERIFY, ARCHIVE, as in `{{CORE}}templates/PHASE_FLOW.template.md`. No phase is skipped.
2. Review each document with the clean-context lenses before it is approved.
3. While applying, a clean-context Reviewer reviews at tier `alto` for always-SDD items (`{{CORE}}AGENT_BASELINE.md` §8, §10).
4. {{OWNER}} applies what cannot be undone, such as migrations on a hosted database.
5. ARCHIVE: move closed work to the archive and update memory.

## Ends when

- ARCHIVE is done and the Verify Gate passes.

## Gates

- Prueba and Revisión; also Seguridad when auth, payments or RLS are touched (`{{ABMH}}gates/security.md`).

## Escalates to SDD when

- This is the top lane. If scope is unclear, interview first (`{{CORE}}protocols/GRILL.md`).
