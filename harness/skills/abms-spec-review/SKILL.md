---
name: abms-spec-review
description: Review a SPEC, DESIGN or PROPOSAL with four fresh-context read-only reviewers (comprehension, readiness, consistency, risk) and write a severity-ranked report. Use after a SPEC, DESIGN or PROPOSAL is drafted, or when {{OWNER}} asks.
argument-hint: <path to SPEC, DESIGN or PROPOSAL>
---

# abms-spec-review

> Specified in `_docs/specs/SPEC-ABMS-004-spec-review-skill.md`, designed in `DESIGN-ABMS-004`. You are the orchestrator. You never review the document yourself and never edit it.

---

## 1. Intake

1. `$ARGUMENTS` is the target path. If empty, ask for it in one plain line and stop.
2. Read the file. If it does not exist, say so and stop.
3. `docid` = the file name up to the first lowercase slug, for example `SPEC-ABMS-004`.
4. `ProjectContext`: walk up from the target to the nearest `PROJECT_CONTEXT.md` in a docs folder and use it. Documents under `_docs/` belong to the system: use `{{CORE}}AGENT_BASELINE.md` and tell the reviewers it is a system document.
5. Compute `shasum -a 256 <target>` and keep the first 12 characters.
6. If the file is over about 12 KB, warn in one line and continue.
7. If the type has no template in `{{CORE}}templates/`, tell the Consistency reviewer `no template for this type`.

## 2. Start the reviewers

1. If you have no subagent tool, stop and say: a review in the same context is not a fresh-context review.
2. State the reason in one line first, per Baseline §9: `Independent verifier: fresh-context review of <docid>, 4 sessions (3 haiku, 1 sonnet).`
3. In one step, start these four in parallel, each with a new context:

|subagent type|model|
|---|---|
|`abms-review-comprehension`|haiku|
|`abms-review-readiness`|haiku|
|`abms-review-consistency`|haiku|
|`abms-review-risk`|sonnet|

4. The prompt to each contains exactly these four lines and nothing from this conversation:

```
TargetFile: <absolute path>
ProjectContext: <absolute path, or "system document">
Lens: {{CORE}}review/<lens>.md
ReadLimit: 8
```

5. If a subagent type is not registered in this session, start a general-purpose subagent with the same model and tell it to read `.claude/agents/<name>.md` and follow it. Subagents have Read, Grep and Glob only; never give them more.

## 3. Collect

1. A reviewer that errors or returns nothing: lens status `not run: <reason>`. Never claim full coverage with a lens missing.
2. Split each reply into findings by the four labels `Severity`, `Scope`, `Finding`, `Recommendation`. Text that does not parse becomes one Nit marked `unparsed`.
3. Count the lines of the target (`wc -l`). A reviewer whose `Lines read` is missing or smaller than the real count is `not run: partial read`; discard its findings.
4. Check each cited path exists (Glob). Drop findings that cite a path that does not exist; count them as `Dropped findings`.
5. Merge findings with the same scope and the same issue into one; keep every lens name on it.
6. Sort Blocker, then Major, then Nit.
7. Tokens per lens: take them from the subagent result when reported, otherwise `n/d`.

## 4. Write the report

1. `mkdir -p` a `reviews/` folder next to the target.
2. Fill `{{CORE}}review/REPORT.template.md` and save it as `reviews/REVIEW-<docid>-<YYYY-MM-DD>.md`. If that name exists, use `-b`, then `-c`. Never overwrite.
3. Recompute the target hash. If it changed, say so in the first line of your reply: a reviewer or something else modified the file.

## 5. Reply to {{OWNER}}

In Spanish, at most 15 lines:

1. `En corto:` counts of Blockers, Majors, Nits, lenses not run, report path.
2. Each Blocker and Major on one line: lens, scope, finding.
3. Nits stay in the file only.
4. Last line: what {{OWNER}} decides next (fix the document, or continue to TASKS).

## Rules

- Agents may start this skill once a SPEC, DESIGN or PROPOSAL is drafted. One review per document per request: never re-run it on the same document by yourself; {{OWNER}} decides what happens after the report.
- Reviewers report; they do not fix. Do not edit the reviewed document, even to apply a finding, unless {{OWNER}} asks afterwards.
- Do not soften or drop a finding because you disagree. Note disagreement after the finding if you must.
- No git actions.
