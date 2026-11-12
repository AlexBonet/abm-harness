# Lane: Bug

> Something is broken, throwing, failing or slow. First line of the turn: `Carril: Bug — <reason>`.

## Entry

- A failure is observed: an error, a wrong result or a regression, often from a monitoring alert.

## Steps

1. Measure the risk first: a fix that touches an always-SDD item goes to SDD.
2. Diagnose with the `diagnose` skill (`{{CORE}}protocols/DIAGNOSE.md`): reproduce, isolate, state the cause in one line.
3. Write a regression test that fails before the fix.
4. Make the smallest fix that makes it pass.
5. One clean-context Reviewer pass: tier `medio`, `alto` if data is involved.
6. Run the Verify Gate.

## Ends when

- The test failed before and passes after, and the cause is written down in one line.

## Gates

- Prueba (`{{ABMH}}gates/test.md`) and Revisión (`{{ABMH}}gates/review.md`).

## Escalates to SDD when

- The fix touches an always-SDD item (stop before that edit and ask).
- The cause is a design flaw: use the short SPEC lane or SDD.
