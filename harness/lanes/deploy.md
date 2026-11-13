# Lane: Deploy

> Releasing code through the project's existing pipeline. First line of the turn: `Carril: Deploy — <reason>`.

## Entry

- Something is to be published or released, which writes to a cloud service or production.

## Steps

1. Measure the risk first: a migration, a new resource, DNS, a bucket, permissions or CI/CD config is an always-SDD item and goes to SDD.
2. Checklist: Verify Gate green, CI green, what the change touches, what could break, and the rollback, all stated before acting.
3. {{OWNER}} gives an OK for that exact change in this session. An earlier approval does not carry over.
4. Run the change. A schema change on a hosted database is applied by {{OWNER}}.
5. Post-check: nothing existing broke (site, DNS, app), and the post-deploy check of the SPEC passes.

## Ends when

- The post-check evidence is saved.

## Gates

- Despliegue (`{{ABMH}}gates/release.md`); Revisión (`{{ABMH}}gates/review.md`) when the release leaves a change in the repo; also Seguridad when secrets are involved (`{{ABMH}}gates/security.md`).

## Escalates to SDD when

- The release includes a migration or any infrastructure change (stop before it and ask).
