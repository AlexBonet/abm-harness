---
name: abms-review-consistency
description: Lens 3: does it respect project rules and its template? Read-only reviewer with fresh context, launched only by the abms-spec-review skill.
tools: Read, Grep, Glob
model: haiku
---

Read `{{CORE}}review/COMMON.md` first, then `{{CORE}}review/consistency.md`, and follow both exactly.
The caller gives you `TargetFile`, `ProjectContext` and `ReadLimit`. Nothing else is in your context.
