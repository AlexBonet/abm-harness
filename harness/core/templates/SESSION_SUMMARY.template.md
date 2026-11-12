# SESSION_SUMMARY — Context Rescue

> **Summary:** {≤ 3 lines: what was done, what is left, the first thing the next session does}
>
> Captured at the end of a session or when context compaction occurs. Ensures the next session can recover full operational context without rediscovering everything. Written by the agent, read by the next session's agent.

---

## Meta

- **Session ID:** {NNN} (increments per project, tracked in MEMORY.md)
- **Agent:** {Coder Android | Coder Web | SCRUM | CEO | Reviewer}
- **Date:** {YYYY-MM-DD}
- **Duration:** {approximate, e.g., "45 min"}

---

## 1. What was accomplished

Bullet list. What code was written, what decisions were made, what artifacts were produced.

- {accomplishment 1}
- {accomplishment 2}
- {accomplishment 3}

---

## 2. What was in progress but not finished

Specific half-done work. The next session needs to know exactly where to pick up.

|Task/Activity|Status|Where to continue|Blocker|
|---|---|---|---|
|{TASK-NNN or description}|{in-progress / partial}|{file:line or section}|{blocker or "none"}|

---

## 3. Decisions made this session

Record every non-obvious choice. Not "I used const instead of let" — but "I chose RPC over client-side multi-mutation because of ACID guarantees."

|Decision|Rationale|Alternative rejected|
|---|---|---|
|{decision}|{why}|{what was not chosen and why}|

---

## 4. Decisions that need to be made

Questions or choices that came up and were deferred. The next session or the human must resolve these.

- [ ] {question needing a decision}
- [ ] {question needing a decision}

---

## 5. Files changed

|File|Change type|Notes|
|---|---|---|
|{path/to/file}|{created / modified / deleted}|{what changed}|

---

## 6. Tests run and results

|Test command|Result|Notes|
|---|---|---|
|{command}|{pass / fail}|{details if fail}|

---

## 7. verify.sh result

- **Exit code:** {0 | non-zero}
- **If non-zero:** {which gate failed, paste relevant output}

---

## 8. Risks and concerns flagged

- {risk or concern 1}
- {risk or concern 2}

---

## 9. Next session start point

The single most important section. If the next agent reads only one thing, it should be this.

**Start with:** {actionable instruction for the next session, e.g., "Fix the failing verify.sh Gate 3 (TypeScript `any` in src/domain/entities/User.ts), then re-run verify.sh"}

---

## 10. Memory updates

Entries to add to `MEMORY.md` after this session:

### Key decisions to record

- {decision to add to MEMORY.md section 2}

### Backfires to record

- {what went wrong to add to MEMORY.md section 3}

### Discoveries to record

- {non-obvious fact to add to MEMORY.md section 4}

---

**Template version:** v1.0