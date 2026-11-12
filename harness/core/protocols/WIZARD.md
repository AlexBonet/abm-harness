# WIZARD — Guided Script for Human-Only Steps

> Applies when the human invokes `/wizard`, or when a step cannot be done by the agent: applying a Supabase migration, DNS, a dashboard setting, credentials, a one-off cutover. Adapted from Matt Pocock's `wizard` (MIT).

---

## Rule

The agent writes the script, the human runs it. The agent never runs it end to end: it opens browsers and waits for input. This makes `AGENT_BASELINE.md` §1.16 (consent, pre-check, post-check) a repeatable procedure.

---

## Procedure

### 1. Scope

Read the repo first (migration files, `.env.example`, config, CI workflows). Show the human the ordered stages and every value each one captures. Done when each value has: where the human gets it, where it is written, secret or public.

### 2. Stage shape

Every stage that writes to the cloud has four beats, in this order:

1. **Pre-check:** print the exact change, what it touches, what could break, the rollback.
2. **Confirm:** wait for explicit `y` before the action.
3. **Action:** the command or the dashboard path, written so a stranger could follow it.
4. **Post-check:** a read-only command that proves nothing existing broke.

Read-only stages skip beats 1-2.

### 3. Author

- Bash, one function per stage, a stage counter ("2/5"), a closing summary.
- Secrets read hidden, never echoed, never written to the script or the log.
- Unknown UI path or command: say so and ask. Do not invent steps.
- Path: scratchpad or `scripts/`. Delete when the job ends, unless the human wants it repeatable.

### 4. Verify and hand off

- [ ] `bash -n` passes; `shellcheck` if available.
- [ ] Every captured value lands where step 1 said.
- [ ] Every cloud write has its four beats.
- [ ] The human is told the exact command to run.

---

**Version:** v1.0
