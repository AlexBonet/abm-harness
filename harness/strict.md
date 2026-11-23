# Strict profile

> Extra rules that only the `abm-estricto` profile installs. They apply on top of `{{CORE}}AGENT_BASELINE.md`.

- COD-09 (pnpm only) also applies to the Prueba gate.
- Use pnpm. Never run `npm` or `npx`; use `pnpm` and `pnpm dlx`.
- Clean Architecture: Domain, then Data, then Presentation. Domain imports no framework, database, UI or I/O.
- Zero code comments. Identifiers in English.
- Code files at most 300 lines; split before continuing.
- Git: Baseline §1.10 applies (never `main`/`master`, never `push --force`); as a subagent for one T, never commit.
