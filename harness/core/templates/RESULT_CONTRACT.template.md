# RESULT_CONTRACT — Phase Envelope

> Standardized output envelope for every SDD phase. The orchestrator (human or CEO) reads this to decide whether to advance, revise, or halt. No phase is complete without producing this envelope.

---

## Meta

- **Phase:** {INIT | PROPOSAL | SPEC | DESIGN | TASKS | APPLY | VERIFY | ARCHIVE}
- **Originated from:** {PROPOSAL-NNN | SPEC-NNN | DESIGN-NNN | TASK-NNN | PROMPT-NNN}
- **Agent:** {SCRUM | Coder Android | Coder Web | Reviewer | CEO}
- **Timestamp:** {YYYY-MM-DDTHH:MM}

---

## 1. Status

**{approved | rejected | needs_revision | halted}**

- **approved** — Phase completed successfully. Next phase can start.
- **rejected** — Phase output does not meet criteria. Must be redone.
- **needs_revision** — Phase output has issues that can be fixed without restarting.
- **halted** — Cannot proceed. External blocker or missing dependency.

---

## 2. Executive summary

One to three sentences. What was accomplished or what went wrong. Written for a reader who has not seen the phase details.

---

## 3. Artifact produced

|Artifact|Path|Status|
|---|---|---|
|{PROPOSAL-NNN.md}|{shared-domain/proposals/PROPOSAL-NNN-*.md}|{draft / approved}|
|{SPEC-NNN.md}|{shared-domain/specs/SPEC-NNN-*.md}|{draft / approved}|
|{DESIGN-NNN.md}|{shared-domain/designs/DESIGN-NNN-*.md}|{draft / approved}|
|{TASK-NNN.md}|{shared-domain/tasks/current/TASK-NNN-*.md}|{draft / approved}|

---

## 4. Next recommended action

What the orchestrator should do next. One of:

- **Advance to {next phase name}** — proceed with the SDD flow.
- **Revise {artifact}** — the artifact needs changes before the next phase.
- **Escalate to human** — the agent cannot decide; needs human input.
- **Block — waiting for {dependency}** — cannot proceed until resolved.

---

## 5. Risk level

**{low | medium | high}**

- **low** — Well-understood change, no open questions, standard flow.
- **medium** — Some uncertainty, edge cases to watch, may need revision.
- **high** — Architectural impact, multiple areas affected, or open questions that could change the approach.

---

## 6. Skill resolution

|Skill|Status|Notes|
|---|---|---|
|{skill name}|{applied | not_available | fallback}|{what happened}|

- **applied** — Skill was found and used successfully.
- **not_available** — Skill does not exist for this runtime or stack.
- **fallback** — Skill was expected but fell back to default behavior.

---

## 7. Evidence (for VERIFY phase only)

When the phase is VERIFY, this section is mandatory.

- **verify.sh exit code:** {0 | non-zero, with output}
- **Files changed:** {count}
- **Git diff summary:** {one line}
- **Tests run:** {command and result}
- **Linter result:** {pass/fail, with output if fail}
- **Architecture boundary check:** {pass/fail}

---

**Template version:** v1.0