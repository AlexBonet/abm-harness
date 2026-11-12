# Gate: Diseño

> Visual and interaction quality of screens and components.

## Checks

- Floor: contrast, visible focus, touch targets and a usable mobile layout.
- Reflexes: the project's tokens and design rules are used, not hardcoded values.
- Finish: spacing, hierarchy and states (empty, loading, error) are looked at in a real browser at several widths.
- Rules: DSN-01, DSN-02. Run `{{ABMH}}checks/check.sh diseño`; a FAIL blocks, a NOT RUN is reported. Reflexes and finish are judged by the Diseñador; the project's own design document is the reference.

## Who

- The Diseñador (`{{ABMH}}agents/designer.md`), with the Verificador for the browser check.

## Applies when

- A change adds or alters a screen, a component or its styling.

## Evidence

- Screenshots at the widths checked, and the list of issues found and fixed.
