# Gate: Prueba

> The result behaves as the SPEC, FEATURE or request says.

## Checks

- The project's `verify.sh` (or equivalent) exits 0.
- New behavior has a test; a bug fix has a test that failed before the fix and passes after. Tests come first where the project has tests.
- Every acceptance item is ticked only with observed evidence; a check that was not run is listed as NOT RUN.
- Rules: COD-01, COD-02, COD-03, COD-04, COD-05, COD-06, COD-07, COD-08, COM-01, COM-02, COM-03, COM-04, MIG-01, MIG-02, MIG-03. Run `{{ABMH}}checks/check.sh prueba`; a FAIL blocks, a NOT RUN is reported. MIG rules only exist where the data pack is installed.

## Who

- The Coder runs it; the Verificador ticks it (`{{ABMH}}agents/verifier.md`).

## Applies when

- Every lane that changes the project: Cambio, SPEC corta, SDD, Bug.

## Evidence

- The command, its exit code and the test names, in the Post-Flight report.
