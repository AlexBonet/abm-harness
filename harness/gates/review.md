# Gate: Revisión

> Someone who did not write the change looks at it with fresh context, after every whole task, in every lane.

## Checks

- A Reviewer with clean context (it has not seen the Coder's reasoning) reviews the diff or the document at the depth of the tier (`{{CORE}}AGENT_BASELINE.md` §8).
- Every finding is checked against the code before it is applied; a finding the code does not support is rejected with one line.
- Every claim the Coder will make to {{OWNER}} is passed with `--claims` and checked against the evidence. The Post-Flight report repeats only claims the Reviewer saw.
- Only blocking issues reject (broken rule, missing or wrong requirement, bug, security hole, data loss, unsupported claim); minor issues go in `Notes:` from round 1.
- Every decision is logged in the SPEC's decision log, or in the Post-Flight `Decisions:` line when there is no SPEC.

## Who

- The Reviewer (`{{ABMH}}agents/reviewer.md`), launched by the Coder itself, automatically, when a whole task is done and before the Post-Flight report. {{OWNER}} never has to ask for it.
- **Which family** comes from `reviewer:` in `harness.yaml`: `opposite` (default: Claude codes → Codex reviews; Codex codes → Claude reviews), `claude` or `codex`. If the chosen family cannot run, the other one reviews and the Post-Flight report says so.
- **Which size:**
  - Large task → Claude Sonnet, or the stronger Codex model.
  - Small task → Claude Haiku, or the cheaper Codex model.
  - Large means tier `alto`, more than one module, or more than ~150 changed lines. Anything else is small.
- **How:** `sh {{ABMH}}reviewer/review.sh --coder <claude|codex> --size <small|large> --task "<what was asked>" --claims "<what you will tell {{OWNER}} you did: one short line per claim, e.g. tests pass, migration added>"`, the same command after a fix. Work already committed (one commit per T) needs `--base <commit before the first T>`; without it only uncommitted changes are reviewed. The Reviewer checks each claim against the evidence; a claim it cannot back is a finding. The Reviewer often cannot run commands itself, so for a claim about a command you ran (tests, `verify.sh`), save its output to a file outside the repo and name that file in the claim. It picks family and model (and the other family if the first gives no verdict), raises the size past 150 changed lines, counts the rounds itself, records the verdict for the current diff and refuses a third round in a row without `--owner-ok`. Model names can be changed in `harness.yaml` with `reviewer_<family>_<size>`.
- **Guard:** with Claude, a Stop hook in `.claude/settings.json` blocks closing a turn once while the session's diff has no verdict.

## Rounds

1. **APPROVED** → tell {{OWNER}} and close the task.
2. **First REJECTED** → check each finding against the code, fix what holds, and launch a new clean Reviewer on the new diff.
3. **Round 2 is narrower.** The Reviewer checks that each round-1 finding is fixed, or rejected with a reason that holds. It rejects only for a round-1 finding still open or a new severe defect (security hole, data loss, broken core behaviour, part of the task not done). Other new issues go in `Notes:` and do not block.
4. **Second REJECTED** → stop. Tell {{OWNER}} which findings remain and why they could not be fixed. No third round without {{OWNER}}.

## Applies when

- Always, in every lane that leaves a change: Cambio, SPEC corta, SDD, Bug and Deploy. Consulta writes nothing and has no review.
- Docs-only changes too: a small Reviewer checks that the docs are clear, true to the code and consistent with each other.
- Once per whole task, not after each edit or each T. A whole task is what {{OWNER}} asked to implement: the whole TASKS document (or the part of it asked for) when there is one; otherwise the requested change.
- SPEC corta and SDD also review while building (`{{CORE}}AGENT_BASELINE.md` §10); this gate is the final pass.

## Evidence

- The verdict with `Tier:`, `Diff:` (the fingerprint of the reviewed diff), `Reviewer:` (family and model) and `Round:` (1 or 2). If the diff changes afterwards, the verdict no longer applies.
