# DIAGNOSE — Bug Diagnosis Protocol

> Applies when something is broken, throwing, failing or slow. Loaded by the baseline pointer (`AGENT_BASELINE.md` §6). Adapted from Matt Pocock's `diagnosing-bugs` (MIT).

---

## Rule

No hypothesis before a red loop. A **red loop** is one command, already run once, that drives the real bug path and asserts the exact symptom the human described.

---

## Phases

Each phase ends on its checkable criterion. Do not start the next one before it holds.

### 1. Build the loop

Pick the first that fits:

1. Failing test at the seam that reaches the bug.
2. Script against local dev server or local Postgres.
3. Fixture input diffed against known-good output.
4. Replay of a captured payload or log.
5. Bisection (`git bisect run`) when the bug appeared between two states.
6. Human-in-the-loop script, last resort.

Done when the loop is **tight**: red on this bug, deterministic, seconds long, runnable unattended. Flaky bug: raise the reproduction rate until it is debuggable.

No loop possible: stop, list what was tried, ask the human for access, a redacted artifact or permission to instrument.

### 2. Reproduce and minimise

Done when the loop shows the human's symptom (not a neighbour bug) and every remaining input, config and step is load-bearing: removing any one turns it green.

### 3. Hypothesise

Write 3-5 ranked hypotheses, each as `If X is the cause, then changing Y removes the bug`. Show the list to the human before testing. Proceed on own ranking if the human is away.

### 4. Instrument

One probe per prediction, one variable at a time. Prefer debugger or REPL, then targeted logs. Tag every log `[DEBUG-xxxx]` so cleanup is one grep. Performance bugs: measure a baseline first, then bisect.

### 5. Fix and regression test

Turn the minimised repro into a failing test at a seam that exercises the real bug pattern, watch it fail, fix, watch it pass, re-run the original loop. No honest seam: record that as a finding for the human (the architecture blocks locking the bug down).

### 6. Cleanup

- [ ] Original loop no longer red
- [ ] Regression test passes, or missing seam documented
- [ ] `grep` for `[DEBUG-` returns nothing
- [ ] Throwaway scripts removed
- [ ] Confirmed hypothesis stated in `Decisions:` of the Post-Flight Report

---

## ABMS constraints

- Loops run against local code and a local temporary Postgres, never against Supabase, Firebase or production (`AGENT_BASELINE.md` §1.16). Cloud reads are free; cloud writes need consent.
- Quote `<REDACTED>` in place of keys, tokens and auth headers in every command and output shown.
- Git follows `AGENT_BASELINE.md` §1.10: commits on the working branch, never on `main`/`master` or with `push --force`; a fix lands in a whole, reviewed commit.

---

**Version:** v1.0
