# Decisions

Audience: both

> **Summary:** why each important thing was done, one decision per file.
> Written when something hard to reverse is decided; never deleted, only superseded.
> Last reviewed: YYYY-MM-DD

This is where you keep **why** each important thing was done, so neither you nor the assistant has to guess later.

## How to use it

1. When a decision is hard to reverse (technology, structure, a business rule), copy `TEMPLATE.md` to `ADR-001-short-title.md` (the number goes up with each decision).
2. Fill it in a few lines: context, decision, rejected alternatives and consequences.
3. One decision per file. They are never deleted: if one changes, write a new one and mark the old one as superseded.

## For the assistant

Before proposing something big, read this folder. When something is decided, leave the ADR here. The full template is in `.abmh/core/templates/ADR.template.md`.
