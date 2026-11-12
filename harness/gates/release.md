# Gate: Despliegue

> A release is ready, approved and reversible.

## Checks

- Verify Gate green and CI green.
- The checklist states what the change touches, what could break and the rollback, before acting.
- {{OWNER}} approved that exact change in this session.
- After releasing: nothing existing broke (site, DNS, app) and the post-deploy check passes.
- Rules: DEP-01, DEP-02, DEP-03, DEP-04. Run `{{ABMH}}checks/check.sh despliegue`; a FAIL blocks, a NOT RUN is reported. The human's OK for each cloud write and the wait on high risk stay with the Operador de release.

## Who

- The Operador de release (`{{ABMH}}agents/release-operator.md`), with {{OWNER}} for the approval.

## Applies when

- Every Deploy. A release that includes a migration or an infrastructure change is SDD, not Deploy.

## Evidence

- The checklist, the approval and the post-check result, saved in the project docs.
