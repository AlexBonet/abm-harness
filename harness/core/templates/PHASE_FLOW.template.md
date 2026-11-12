# PHASE FLOW — SDD Process

> Defines the mandatory phase sequence and artifact dependencies for the ABMS **SDD lane** (Spec-Driven Development, `AGENT_BASELINE.md` §7). Inside this lane no phase may be skipped. No artifact may be produced without its required inputs.

---

## 1. Phase DAG

The phases execute in strict order. Some phases can run in parallel when their inputs are satisfied.

```
                     ┌──────────┐
                     │   INIT    │
                     │ (Phase 0) │
                     └─────┬────┘
                           │
                           ▼
                     ┌──────────┐
                     │ PROPOSAL  │
                     │ (Phase 1) │
                     └─────┬────┘
                           │
                     ┌─────┴─────┐
                     │           │
                     ▼           ▼
              ┌──────────┐ ┌──────────┐
              │   SPEC    │ │  DESIGN   │  ← Can run in parallel
              │ (Phase 2) │ │ (Phase 3) │     after PROPOSAL
              └─────┬────┘ └─────┬────┘
                    │            │
                    └─────┬──────┘
                          │
                          ▼
                    ┌──────────┐
                    │   TASKS    │
                    │ (Phase 4) │
                    └─────┬────┘
                          │
                          ▼
                    ┌──────────┐
                    │   APPLY    │
                    │ (Phase 5) │
                    └─────┬────┘
                          │
                          ▼
                    ┌──────────┐
                    │  VERIFY    │
                    │ (Phase 6) │
                    └─────┬────┘
                          │
                          ▼
                    ┌──────────┐
                    │  ARCHIVE   │
                    │ (Phase 7) │
                    └───────────┘
```

---

## 2. Phase descriptions

|Phase|Name|Agent|Produces|Input required|
|---|---|---|---|---|
|0|INIT|Coder|Calibrated workspace|`init.sh` passes|
|1|PROPOSAL|SCRUM/PO|PROPOSAL-NNN|Business need from human|
|2|SPEC|SCRUM/PO|SPEC-NNN|PROPOSAL-NNN|
|3|DESIGN|SCRUM/PO (or Coder with SCRUM guidance)|DESIGN-NNN|PROPOSAL-NNN + SPEC-NNN|
|4|TASKS|SCRUM/PO|TASK-NNN (one or more)|SPEC-NNN + DESIGN-NNN|
|5|APPLY|Coder|Code changes, PROMPT-NNN output|TASK-NNN → PROMPT-NNN|
|6|VERIFY|Reviewer (or automated `verify.sh`)|Verdict: APPROVED / REJECTED|Code diff + `verify.sh` result|
|7|ARCHIVE|SCRUM/PO|Archived artifacts, updated STATUS.md|APPROVED verdict|

---

## 3. Artifact dependency rules

These rules are **mandatory**. If a required input artifact does not exist, the phase MUST NOT start.

|Phase|Cannot start without|Enforced by|
|---|---|---|
|PROPOSAL|Business need description (can be informal)|Human approval|
|SPEC|PROPOSAL-NNN (status: approved)|SCRUM agent check|
|DESIGN|PROPOSAL-NNN + SPEC-NNN (both approved)|SCRUM agent check|
|TASKS|SPEC-NNN + DESIGN-NNN (both approved)|SCRUM agent check|
|APPLY|TASK-NNN + PROMPT-NNN forwarded by human|Coder pre-flight (`init.sh`)|
|VERIFY|Code diff from APPLY|`verify.sh` + Reviewer protocol|
|ARCHIVE|VERIFY verdict: APPROVED|SCRUM agent|

### Skipping phases

- **INIT** can never be skipped. If `init.sh` fails, the session stops.
- **Small, well-understood changes do not enter this flow.** They take the **Cambio** lane (`AGENT_BASELINE.md` §7): inline, or with one FEATURE document. This flow is the **SDD** lane, mandatory for the always-SDD list in §7.
- **PROPOSAL → SPEC + DESIGN** can be collapsed inside the SDD lane IF the human explicitly approves. In that case, a minimal PROPOSAL is still created but SPEC and DESIGN are merged.
- **VERIFY** can never be skipped. `verify.sh` MUST exit with code 0.

---

## 4. Phase gate protocol

Each phase transition is a gate. Before moving to the next phase:

1. **Check inputs exist.** Required artifacts must be present and in the correct status.
2. **Check inputs are approved.** Status must be `approved`, not `draft`.
3. **Check no blockers.** Open questions in the current phase must be resolved.
4. **Human approval for phases 1, 2, 3.** The human must explicitly approve before proceeding. The SCRUM agent does not auto-advance.

---

## 5. Result contract between phases

When a phase completes, it produces a result envelope:

```yaml
status: approved | rejected | needs_revision
summary: "One-line executive summary"
artifact: {filename of the produced artifact}
next_recommended: {next phase name}
risk: {low | medium | high}
skill_resolution:
  applied: [{list of skills applied}]
  missing: [{list of skills not available}]
  fallback: [{list of fallback behaviors used}]
```

The orchestrator (human or CEO) reads this envelope to decide whether to advance, revise, or halt.

---

## 6. Fast path for small changes

Not every change needs the full SDD flow. The delegation harness defines thresholds:

|Change type|Flow to use|Approval|
|---|---|---|
|Typo, one-line fix, config tweak|**Inline** — Coder fixes directly, then runs verify.sh|Human reviews the diff|
|Small change: ≤ 2 files, no schema, RLS or contract change|**Collapsed SDD** — minimal PROPOSAL, SPEC and DESIGN merged into the TASK|Human approves the TASK|
|Feature, refactor, multi-file change|**SDD** — Full flow from PROPOSAL|Human approves at gates|
|Ambiguous, architectural, cross-cutting|**SDD with explicit risk flag** — Extra design review|Human + CEO approval|

The SCRUM agent classifies the change type. The human can override the classification.

---

**Template version:** v1.1