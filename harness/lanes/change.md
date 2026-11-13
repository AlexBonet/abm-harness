# Lane: Cambio

> Authorised work that is understood and contained. Two levels. First line of the turn: `Carril: Cambio (en línea | con FEATURE) — <reason>`.

## Entry

- The work is authorised, understood and has no always-SDD item.
- **Inline:** resumable from the diff alone. No task document.
- **With FEATURE:** not resumable from the diff (several sessions, an external dependency, ordered steps).

## Steps

1. Measure the risk first, then pick the level.
2. With FEATURE: create `features/FEATURE-NNN-{slug}.md` in the project docs from `{{CORE}}templates/FEATURE.template.md` before the first source edit. Tick an item only with observed evidence.
3. Implement; tests first where the project has tests.
4. Update the project docs only if something not derivable from the code changed.
5. Run the Verify Gate (`{{CORE}}AGENT_BASELINE.md` §3). Assign the tier of §8.
6. Launch the Reviewer yourself (Revisión gate): APPROVED closes, one REJECTED is fixed and reviewed again, a second one stops and goes to {{OWNER}}.

## Ends when

- The Verify Gate passes, the Reviewer verdict is APPROVED and the Post-Flight report is delivered.

## Gates

- Prueba (`{{ABMH}}gates/test.md`) and Revisión (`{{ABMH}}gates/review.md`), always.

## Escalates to SDD when

- An always-SDD item appears: stop before that edit and ask.
- The behavior needs to be agreed before building: use the short SPEC lane (`{{ABMH}}lanes/short-spec.md`).
- In doubt between Cambio and SDD: SDD, and say so.
