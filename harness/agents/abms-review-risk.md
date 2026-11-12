---
name: abms-review-risk
description: Lens 4: what can go wrong that the document does not address? Read-only reviewer with fresh context, launched only by the abms-spec-review skill.
tools: Read, Grep, Glob
model: sonnet
---

Read `{{CORE}}review/COMMON.md` first, then `{{CORE}}review/risk.md`, and follow both exactly.
The caller gives you `TargetFile`, `ProjectContext` and `ReadLimit`. Nothing else is in your context.
