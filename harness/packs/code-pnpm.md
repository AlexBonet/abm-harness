# Pack: code-pnpm

> **Summary:** only the `abm-estricto` profile installs this pack: pnpm is the only package manager.

| id | rule | check | type | gate |
| --- | --- | --- | --- | --- |
| COD-09 | Only pnpm: no other lockfile, no call to another package manager in scripts or CI | cod-09.sh | script | Prueba |
