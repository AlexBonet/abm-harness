# Gate: Revisión

> Someone who did not write the change looks at it with fresh context.

## Checks

- A Reviewer with clean context (it has not seen the Coder's reasoning) reviews the diff or the document at the depth of the tier (`{{CORE}}AGENT_BASELINE.md` §8).
- Every finding is checked against the code before it is applied; a finding the code does not support is rejected with one line.
- Every decision is logged in the SPEC's decision log.

## Who

- The Reviewer, in its own session (`{{ABMH}}agents/reviewer.md`).

## Applies when

- Always in SPEC corta, SDD and Bug.

## Evidence

- The verdict with `Tier:` and `Diff:` (the fingerprint of the reviewed diff). If the diff changes afterwards, the verdict no longer applies.
