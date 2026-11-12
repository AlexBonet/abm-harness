---
name: diagnose
description: Diagnosis loop for bugs. Use when something is broken, throwing, failing, slow, or the user says "debug" or "diagnose".
---

# diagnose

Read `{{CORE}}protocols/DIAGNOSE.md` and follow it. It is the base of the Bug lane.

- Build a red loop (a fast, repeatable failing check) before forming any hypothesis.
- State the cause in one line, then write the regression test that fails before the fix.
- Never patch the symptom while the cause is not understood.
