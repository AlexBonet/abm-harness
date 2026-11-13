# Pack: data

> **Summary:** how migrations are written, numbered and reviewed, whatever the database. Each rule has an id and a named check; `{{ABMH}}checks/check.sh prueba` runs MIG-01 to MIG-03 and `check.sh seguridad` runs MIG-04.

| id | rule | check | type | gate |
| --- | --- | --- | --- | --- |
| MIG-01 | Every migration opens with `-- spec:`, `-- local-test: yes`, `-- backup:` and `-- rollback:` | mig-01.sh | script | Prueba |
| MIG-02 | Numbers follow the pattern with no gap and no repeat, and each migration is listed in `00-docs/data/` | mig-02.sh | script | Prueba |
| MIG-03 | Dropping or retyping a column or table needs `-- expands:` naming the earlier migration that added the replacement | mig-03.sh | script | Prueba |
| MIG-04 | A new migration that touches policies, grants or row-level security needs the Seguridad gate and tier alto | mig-04.sh | script | Seguridad |

## Settings

Keys in `harness.yaml`, written by hand:

- `migrations_dir:` the folder; without it `supabase/migrations`, `migrations` and `db/migrations` are tried.
- `migration_pattern:` default `NNN_name.sql`; the run of `N` is the digit width, `name` is any name. A project can use `dev_NNN_name.sql`.
- `migrations_from:` default `1`; files numbered below it are legacy and no MIG check looks at them.
- `migrations_baseline:` optional file of exact legacy names, one per line (`#` comments allowed). With it, a file is legacy only if listed; any other file is new whatever its number, so it is fully checked. An entry numbered `migrations_from` or higher is a MIG-02 failure: the list can only shrink.
- `migration_prefixes:` optional families such as `dev_` (`dev_NNN_name.sql`). Each family is checked for repeats; only the main family is checked for gaps.
- `migration_companions:` optional prefixes such as `rollback_` whose files accompany a migration and are not migrations themselves.
- `migrations_registry:` folder of `.md` files that list the migrations; default `data/` inside the docs folder. A migration is listed when a file names it, or a row holds its number and its name.
- MIG-04 reports NOT RUN with the warning for each new or changed file; it is resolved by the Seguridad gate, not by editing the file. It compares with `ABMH_BASE` (default `HEAD`).

## Waiting for an agent

No script can judge these; they stay out until an agent check exists:

- The agent writes the migration and the human applies it (baseline §1.16).
- When data is transformed, counts before and after are recorded.
- A fresh backup and a proven restore exist before any destructive migration.
