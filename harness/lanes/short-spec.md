# Lane: SPEC corta

> Between Cambio and SDD: a short SPEC, then build. First line of the turn: `Carril: SPEC corta — <reason>`.

## Entry

- The work is not resumable from the diff and its behavior is worth agreeing first.
- It has no always-SDD item and needs no separate design.

## Steps

1. Measure the risk first.
2. Write the SPEC from `{{CORE}}templates/SPEC-SHORT.template.md` into the project docs `specs/`. No PROPOSAL, DESIGN or TASKS.
3. {{OWNER}} confirms the summary. Nothing is built before that.
4. Implement; tests first where the project has tests.
5. A clean-context Reviewer reviews the work while it is built, at tier `medio` or higher (`{{CORE}}AGENT_BASELINE.md` §8, §10). Check each finding against the code and log each decision in the SPEC.
6. Run the Verify Gate.

## Ends when

- Every acceptance item is ticked with evidence, the Reviewer verdict records `Tier:` and `Diff:`, and the Verify Gate passes.

## Gates

- Prueba (`{{ABMH}}gates/test.md`) and Revisión (`{{ABMH}}gates/review.md`), always.

## Escalates to SDD when

- An always-SDD item appears: stop before that edit and ask.
- The SPEC grows past 8 KB or needs a design decision that someone else must approve.
