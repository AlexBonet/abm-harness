---
name: wizard
description: Generate a guided shell script for steps only the human can perform, such as applying migrations, DNS or dashboard setup.
disable-model-invocation: true
---

# wizard

Use it only when {{OWNER}} asks for it by name.

Read `{{CORE}}protocols/WIZARD.md` and follow it.

- You write the script, {{OWNER}} runs it. Never run the generated script yourself, with any assistant.
- State the check before and the check after, as the consent rule of the baseline asks.

Source: idea from Matt Pocock's `wizard` skill (MIT licence); nothing is copied.
