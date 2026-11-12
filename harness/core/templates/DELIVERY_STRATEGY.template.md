# DELIVERY_STRATEGY — How to Ship the Change

> Defines how a completed and verified change is delivered to the repository. The strategy depends on the size and risk of the change. The Reviewer recommends a strategy based on the risk assessment from the REVIEW_CHECKLIST. The human makes the final call.

---

## 1. Strategy options

### 1.1 Ask on Risk (default)

**When to use:** Low-risk changes, small scope, single-layer changes.

**Protocol:**
- The Coder works normally.
- The harness stops (asks the human) only when it detects risk: a failing test, an architectural boundary violation, or a change that exceeds the expected scope.
- The human reviews the diff and decides whether to proceed.

**Delivery:** Single commit or PR after human approval.

---

### 1.2 Auto-chain

**When to use:** Medium-risk changes that touch multiple areas but can be decomposed into independent units.

**Protocol:**
- The SCRUM agent decomposes the change into a sequence of small, independent PRs.
- Each PR is small enough to review in under 15 minutes (< 400 lines, < 8 files).
- PRs are chained: PR-2 depends on PR-1, PR-3 depends on PR-2, etc.
- Merge order matters. Each PR must pass `verify.sh` independently.

**Delivery:** Multiple stacked PRs, merged in order.

---

### 1.3 Single PR

**When to use:** Changes that are logically inseparable but small enough to review (< 400 lines total).

**Protocol:**
- One PR with all changes.
- The PR description references the TASK and includes the Coder's post-flight report.
- The Reviewer runs the full checklist.

**Delivery:** One PR, reviewed and merged.

---

### 1.4 Exception (Explicit Justification Required)

**When to use:** Changes that exceed the 400-line threshold but are genuinely inseparable. Examples: a migration that touches many files, a framework upgrade, a large refactoring that has no intermediate stable state.

**Protocol:**
- The Coder or SCRUM must document WHY the change cannot be decomposed.
- The TASK/PROMPT must explicitly mark it as an exception with justification.
- The Reviewer still runs the full checklist.
- The human must approve the exception before the Coder starts work.

**Delivery:** Single PR with explicit exception note in the description.

---

## 2. Choosing a strategy

The Reviewer recommends a strategy based on the risk assessment:

|Risk|Lines changed|Files|Layers|Recommended strategy|
|---|---|---|---|---|
|Low|< 150|1-3|Single|Ask on Risk|
|Medium|150-400|4-8|2|Auto-chain or Single PR|
|High|> 400|> 8|3+|Exception with justification|

The human can override the recommendation. Document the override in the TASK.

---

## 3. Branch strategy

### 3.1 Stacked PRs (for Auto-chain)

```
main ← PR-1 (base change)
  └── feature/APP-TASK-042-a ← PR-2 (depends on PR-1)
        └── feature/APP-TASK-042-b ← PR-3 (depends on PR-2)
```

- Each branch is small and reviewable.
- Merge order: PR-1, then rebase PR-2, merge PR-2, etc.
- Branch naming: `feature/{PROJECT}-TASK-{NNN}-{slug}`

### 3.2 Feature branch (for Single PR or Ask on Risk)

```
main ← feature/APP-TASK-042
```

- One branch, one PR.
- Branch naming: `feature/{PROJECT}-TASK-{NNN}-{slug}`
- Human creates an empty PR at the start and adds commits as the Coder progresses.

### 3.3 Squash to main (for startups / rapid iteration)

```
main ← direct merge, squashed
```

- Only for projects where the team can fix anything quickly.
- NOT recommended for projects with production users.
- The Coder works on a feature branch, but it is squashed into main on merge.

---

## 4. Commit message convention

All commits follow this format:

```
[{PROJECT}-TASK-{NNN}] {imperative description in English}

{Optional body: what changed, why, and any non-obvious decisions}
```

Examples:
```
[APP-TASK-042] Add inventory count validation
[APP-TASK-058] Refactor inventory entity extraction into value object
[API-TASK-003] Fix duplicate event creation on concurrent requests
```

---

## 5. Pre-merge checklist

Before the human merges any PR:

- [ ] `verify.sh` passes with exit code 0
- [ ] Reviewer verdict is APPROVED
- [ ] No domain purity violations
- [ ] No hardcoded strings (i18n verified)
- [ ] Migration files are sequential and do not edit prior migrations
- [ ] Post-flight report from Coder is attached to the PR
- [ ] TASK is marked as DONE in STATUS.md (if applicable)

---

**Template version:** v1.0