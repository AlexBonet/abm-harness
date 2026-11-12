# TDD_PROTOCOL — Strict Test-Driven Development

> Mandatory protocol for projects that declare strict TDD. When active, the Coder MUST follow this cycle for every implementation change. The harness enforces it — the agent doesn't need to remember, the harness demands it.

---

## 1. When this protocol applies

This protocol is active when `PROJECT_CONTEXT.md` or the task prompt declares **strict TDD**. When active:

- Every implementation change must start with a failing test.
- No implementation code is written before a test exists.
- The `verify.sh` gate includes a TDD compliance check.
- The Reviewer checks for TDD evidence in the diff.

---

## 2. The TDD cycle

For each behavior change, the Coder follows this exact sequence:

### Step 1: RED — Write a failing test

1. Identify the behavior to implement from the TASK/PROMPT.
2. Write a test that describes the expected behavior.
3. Run the test. It MUST fail. If it passes, the behavior already exists or the test is wrong.
4. A failing test proves the behavior is not yet implemented.

**Evidence:** The diff must contain a new test that fails.

### Step 2: GREEN — Write the minimum code to pass

1. Write the simplest implementation that makes the failing test pass.
2. Do not add functionality beyond what the test requires.
3. Do not refactor yet. Make it work, not make it pretty.
4. Run the test. It MUST pass.

**Evidence:** The test that was red now passes. No other tests break.

### Step 3: TRIANGULATE — Add more test cases

1. If the implementation has edge cases or the behavior has variations, add more tests.
2. Each new test should drive the implementation toward generality (not special-casing).
3. Run all tests. They must all pass.

**Evidence:** Multiple tests covering the same behavior with different inputs.

### Step 4: REFACTOR — Clean up while keeping tests green

1. Now improve the code: extract duplication, improve names, simplify structure.
2. Split files over 300 lines.
3. Run all tests after each refactor step. If any test breaks, revert and try again.
4. The refactored code must be functionally identical to the pre-refactored code.

**Evidence:** Diff shows structural improvement, no behavioral change. All tests still pass.

---

## 3. TDD compliance checklist

The Reviewer and `verify.sh` check for ALL of these:

- [ ] Every new implementation file has a corresponding test file
- [ ] The test file was created BEFORE or alongside the implementation (git history shows this)
- [ ] Test coverage includes the happy path and at least one edge case
- [ ] No implementation file was modified without a test that exercises the change
- [ ] All tests pass (verified by `verify.sh` Gate 6)

---

## 4. Exceptions and pragmatism

Strict TDD does NOT mean dogmatic TDD. Some situations are exempt:

|Situation|Protocol|Justification|
|---|---|---|
|Bug fix in existing code|Write a regression test first, then fix|The test proves the bug exists and the fix works|
|UI layout / styling changes|No TDD required for pure layout|Visual changes are verified by the human, not automated tests|
|Database migration (schema only)|Test that migration applies and rolls back|No behavioral test for DDL|
|Configuration changes|Verify the config is loaded correctly|Minimal test|
|Prototyping / spike|Mark the TASK as `spike` in STATUS.md|Spikes are disposable; TDD does not apply|

When an exception is used, the TASK must document which exception and why.

---

## 5. Enforcing the protocol

### In `AGENTS.md` / `AGENT.md`

The Coder's AGENTS.md must include:

```
## TDD Protocol (STRICT)
This project follows strict TDD. Read {{CORE}}templates/TDD_PROTOCOL.template.md
before starting any implementation. The cycle is RED → GREEN → TRIANGULATE → REFACTOR.
No implementation without a failing test first.
```

### In `verify.sh`

The verification script checks:
1. Test files exist for new implementation files
2. All tests pass
3. Coverage does not decrease (if coverage tools are configured)

### In the Reviewer protocol

The Reviewer checks:
1. TDD compliance checklist items (Section 3 above)
2. No implementation-only diffs without corresponding test diffs
3. Refactoring diffs preserve behavior (tests still pass)

---

## 6. Example flow

```
1. Coder reads PROMPT-042: "Add inventory count validation"
2. Coder writes test: validateInventoryCount_throwsWhenNegative()
3. Coder runs test → FAILS (red) ✅
4. Coder writes minimum implementation: InventoryValidator.validate()
5. Coder runs test → PASSES (green) ✅
6. Coder adds: validateInventoryCount_throwsWhenZero(), validateInventoryCount_acceptsPositive()
7. Coder runs tests → ALL PASS (triangulate) ✅
8. Coder refactors: extracts shared validation logic into Value Object
9. Coder runs tests → ALL PASS (refactor) ✅
10. Coder runs verify.sh → EXIT 0 ✅
11. Task marked DONE
```

---

**Template version:** v1.0