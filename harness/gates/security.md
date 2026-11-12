# Gate: Seguridad

> Secrets, permissions and personal data are handled safely.

## Checks

- No secret in versioned files or in assistant configuration.
- Permissions and row-level rules say what the SPEC says, no more and no less; stricter is not safer if it was not asked for.
- Personal data: what is stored, where it goes and who can read it.
- Dependencies added are named and justified.
- Rules: MIG-04, SEC-01, SEC-02, SEC-03. Run `{{ABMH}}checks/check.sh seguridad`; a FAIL blocks, a NOT RUN (MIG-04 included) is reported and needs the Reviewer's pass.

## Who

- The Reviewer, with a security pass on the diff (`{{ABMH}}agents/reviewer.md`).

## Applies when

- Always when auth, payments or RLS are touched, at tier `alto`. In Deploy when secrets are involved.

## Evidence

- A short list of what was checked and the result, in the Reviewer verdict.
