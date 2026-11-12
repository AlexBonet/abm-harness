---
name: abms-review-readiness
description: Lens 2: can the Coder build it without design decisions? Read-only reviewer with fresh context, launched only by the abms-spec-review skill.
tools: Read, Grep, Glob
model: haiku
---

Read `{{CORE}}review/COMMON.md` first, then `{{CORE}}review/readiness.md`, and follow both exactly.
The caller gives you `TargetFile`, `ProjectContext` and `ReadLimit`. Nothing else is in your context.
