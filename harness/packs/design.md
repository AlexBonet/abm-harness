# Pack: design

> **Summary:** what a screen needs so it is usable and has a design reference. Each rule has an id and a named check; `{{ABMH}}checks/check.sh diseño` runs them and reports PASS, FAIL or NOT RUN per id. Installed where an interface is detected, or with `--packs design`.

| id | rule | check | type | gate |
| --- | --- | --- | --- | --- |
| DSN-01 | `DESIGN.md` or `design-tokens.md` exists at the root or in the docs folder | dsn-01.sh | script | Diseño |
| DSN-02 | The project's declared design command passes (contrast, visible focus, reduced motion) | dsn-02.sh | script | Diseño |

## Settings

- `design_check:` in `{{ABMH}}harness.yaml`, written by hand: the command that checks contrast, focus and reduced motion (a browser-based tool the project already has). Every check runs from the project root; the harness runs it with `sh -c` and starts no browser itself. With none declared, or if the command is not found, DSN-02 reports NOT RUN, never a pass.
- DSN-01 only asks for the document; its content is the Designer's to judge. The choice of design skill belongs to H5, not to this pack.

## Waiting for an agent

No script can judge these; they stay out until an agent check exists:

- Reflexes: the project's tokens and design rules are used, not hardcoded values.
- Finish: spacing, hierarchy and empty, loading and error states looked at in a real browser at several widths.
