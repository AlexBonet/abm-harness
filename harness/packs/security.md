# Pack: security

> **Summary:** how secrets and personal data stay out of the repository and the remote. Each rule has an id and a named check; `{{ABMH}}checks/check.sh seguridad` runs them, the `pre-push` hook runs SEC-01 and SEC-04 on every push, and the CI also runs SEC-03.

| id | rule | check | type | gate |
| --- | --- | --- | --- | --- |
| SEC-01 | No known key pattern and no `.env` file in tracked or new files, assistant configs included | sec-01.sh | script | Seguridad |
| SEC-02 | A rotation procedure `ROTATION.md` exists and the active `pre-push` hook runs SEC-01 | sec-02.sh | hook | Seguridad |
| SEC-03 | No known key pattern in any line added by any commit of any branch (a key deleted later is still in history) | sec-03.sh | script | Seguridad |
| SEC-04 | Nothing under a `.claude/` folder is tracked, at any depth | sec-04.sh | script | Seguridad |

## Settings

- `secrets-allowlist.txt` in the docs folder: one line `path | reason`, a file or a folder ending in `/`. A line without a reason exempts nothing and fails. The human reviews every line.
- SEC-01 reads the working tree (tracked and new files); SEC-03 reads the lines added by every commit of every branch. Both share `sec-patterns.txt`. SEC-03 is NOT RUN on a shallow clone (CI needs `fetch-depth: 0`), with no commits or outside git. A key found in history needs rotation (`ROTATION.md`), not only removal; both checks print `commit:path pattern-name`, never the value.
- SEC-01 prints `path:line pattern-name` and never the value. Bypassing the hook with `--no-verify` is the person's decision.

## Waiting for an agent

No script can judge these; they stay out until an agent check exists:

- Nothing sensitive enters logs, fixtures or the agent's context.
- Personal data (RGPD and LOPDGDD): what is collected, how long it is kept, how it is deleted or exported.
- Which user data may pass through external tools.
- Any contact email in an outgoing `User-Agent` is exactly `hola@google.es` (baseline rule 19).
