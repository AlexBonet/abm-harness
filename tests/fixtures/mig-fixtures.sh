CHECKS=${CHECKS:-$(cd "$(dirname "$0")/.." && pwd)}
ROOT=$(mktemp -d)
pass=0
fail=0

header() {
  printf -- '-- spec: SPEC-1\n-- local-test: yes\n-- backup: none\n-- rollback: undo\n%s%s\n' "${2:+-- expands: $2
}" "${1:-select 1;}"
}

project() {
  rm -rf "$ROOT/p"
  mkdir -p "$ROOT/p/scripts" "$ROOT/p/db" "$ROOT/p/docs"
  printf 'docsDir: docs\nmigrations_dir: db\n%s\n' "$1" > "$ROOT/p/scripts/harness.yaml"
  : > "$ROOT/p/base.txt"
}

run() {
  (cd "$ROOT/p" && ABMH_DIR="$ROOT/p/scripts" sh "$CHECKS/$1.sh" > "$ROOT/out" 2>&1; echo $? > "$ROOT/code")
  code=$(cat "$ROOT/code")
}

expect() {
  label=$1 rule=$2 want=$3
  run "$rule"
  if [ "$code" = "$want" ]; then pass=$((pass + 1)); echo "ok   $label"; else fail=$((fail + 1)); echo "FAIL $label ($rule want $want got $code)"; sed 's/^/     /' "$ROOT/out"; fi
}

CONFIG='migrations_from: 198
migrations_baseline: base.txt
migrations_registry: docs
migration_prefixes: dev_
migration_companions: rollback_'

project "$CONFIG"
printf '001_old.sql\n150_old_drop.sql\ndev_150_old.sql\nrollback_150_old.sql\n063_2_old_suffix.sql\n' > "$ROOT/p/base.txt"
echo 'drop table x;' > "$ROOT/p/db/001_old.sql"
echo 'alter table a drop column c;' > "$ROOT/p/db/150_old_drop.sql"
echo 'select 1;' > "$ROOT/p/db/dev_150_old.sql"
echo 'select 1;' > "$ROOT/p/db/rollback_150_old.sql"
echo 'select 1;' > "$ROOT/p/db/063_2_old_suffix.sql"
expect "historical in baseline: MIG-01 exempt" mig-01 0
expect "historical in baseline: MIG-02 exempt" mig-02 0
expect "historical in baseline: MIG-03 exempt" mig-03 0

echo 'select 1;' > "$ROOT/p/db/151_sneaky.sql"
expect "red: new file below cut-off, not in baseline, needs headers" mig-01 1
rm "$ROOT/p/db/151_sneaky.sql"

printf '198_new.sql\n' >> "$ROOT/p/base.txt"
echo 'select 1;' > "$ROOT/p/db/198_new.sql"
expect "red: baseline cannot cover cut-off or higher" mig-02 1
cp "$ROOT/p/base.txt" "$ROOT/b"; sed '$d' "$ROOT/b" > "$ROOT/p/base.txt"

echo 'select 1;' > "$ROOT/p/db/198_new.sql"
expect "red: new migration without headers" mig-01 1
header > "$ROOT/p/db/198_new.sql"
expect "green: new migration with headers" mig-01 0
expect "red: new migration not in registry" mig-02 1
echo '| `198` | `new` | does a thing |' > "$ROOT/p/docs/inventory.md"
expect "green: registry row with number and name" mig-02 0
echo '198_new.sql' > "$ROOT/p/docs/inventory.md"
expect "green: registry names the file" mig-02 0
echo '| `199` | `new` | other number |' > "$ROOT/p/docs/inventory.md"
expect "red: registry row has another number" mig-02 1
echo '| `198` | `new` | x |' > "$ROOT/p/docs/inventory.md"

header 'alter table a drop column c;' > "$ROOT/p/db/198_new.sql"
expect "red: new drop column without expands" mig-03 1
header 'alter table a drop column c;' 150_old_drop.sql > "$ROOT/p/db/198_new.sql"
expect "red: expands names a migration that adds nothing" mig-03 1
echo 'alter table a add column d int;' > "$ROOT/p/db/149_adds.sql"
printf '149_adds.sql\n' >> "$ROOT/p/base.txt"
header 'alter table a drop column c;' 149_adds.sql > "$ROOT/p/db/198_new.sql"
expect "green: expands names an earlier migration that adds" mig-03 0

header > "$ROOT/p/db/198_new.sql"
header > "$ROOT/p/db/dev_198_new.sql"
echo 'select 1;' > "$ROOT/p/db/rollback_198_new.sql"
expect "green: dev twin and rollback companion beside a new migration" mig-02 0
expect "green: dev twin passes headers" mig-01 0
header > "$ROOT/p/db/dev_198_other.sql"
echo '| `198` | `other` | x |' >> "$ROOT/p/docs/inventory.md"
expect "red: number repeated inside the dev family" mig-02 1
rm "$ROOT/p/db/dev_198_other.sql"
header > "$ROOT/p/db/200_gap.sql"
echo '| `200` | `gap` | x |' >> "$ROOT/p/docs/inventory.md"
expect "red: gap in the main family" mig-02 1
rm "$ROOT/p/db/200_gap.sql"
header > "$ROOT/p/db/199_next.sql"
header > "$ROOT/p/db/dev_199_next.sql"
echo '| `199` | `next` | x |' >> "$ROOT/p/docs/inventory.md"
expect "green: consecutive numbers" mig-02 0
rm "$ROOT/p/db/199_next.sql"
expect "green: dev family may skip a number the main family has" mig-02 0
rm "$ROOT/p/db/dev_199_next.sql"
header > "$ROOT/p/db/198_second.sql"
echo '| `198` | `second` | x |' >> "$ROOT/p/docs/inventory.md"
expect "red: number repeated in the main family" mig-02 1
rm "$ROOT/p/db/198_second.sql"
echo 'select 1;' > "$ROOT/p/db/notes.sql"
expect "red: unknown name outside the baseline" mig-02 1
rm "$ROOT/p/db/notes.sql"

header > "$ROOT/p/db/120_below.sql"
echo '| `120` | `below` | x |' >> "$ROOT/p/docs/inventory.md"
expect "red: new migration numbered below the cut-off outside the baseline" mig-02 1
rm "$ROOT/p/db/120_below.sql"
echo 'select 1;' > "$ROOT/p/db/rollback_250_orphan.sql"
expect "red: rollback companion without a migration" mig-02 1
rm "$ROOT/p/db/rollback_250_orphan.sql"
printf 'x\n' > "$ROOT/p/db/rollback_198_new.sql"
(cd "$ROOT/p" && git init -q 2> /dev/null)
echo 'grant select on t to u;' > "$ROOT/p/db/rollback_198_new.sql"
expect "NOT RUN warning: sensitive SQL in a companion reaches MIG-04" mig-04 2
echo 'select 1;' > "$ROOT/p/db/rollback_198_new.sql"
expect "green: harmless companion passes MIG-04" mig-04 0
echo '| 197 | add column | 198 |' > "$ROOT/p/docs/inventory.md"
mv "$ROOT/p/db/198_new.sql" "$ROOT/p/db/198_add.sql"
mv "$ROOT/p/db/dev_198_new.sql" "$ROOT/p/db/dev_198_add.sql"
mv "$ROOT/p/db/rollback_198_new.sql" "$ROOT/p/db/rollback_198_add.sql"
expect "red: registry row with the number in another column" mig-02 1
echo '| `198` | `add` | x |' > "$ROOT/p/docs/inventory.md"
expect "green: registry row with number and name in their cells" mig-02 0

project 'migrations_from: 3'
echo 'drop table x;' > "$ROOT/p/db/001_old.sql"
header > "$ROOT/p/db/003_new.sql"
echo '003_new.sql' > "$ROOT/p/docs/inventory.md"
mkdir -p "$ROOT/p/docs/data"; echo '003_new.sql' > "$ROOT/p/docs/data/inventory.md"
expect "legacy mode: files below migrations_from stay exempt" mig-03 0
echo 'select 1;' > "$ROOT/p/db/004_new.sql"
expect "legacy mode: new file without headers fails" mig-01 1

project 'migrations_from: 3
migrations_baseline: base.txt'
printf '001_old.sql' > "$ROOT/p/base.txt"
echo 'drop table x;' > "$ROOT/p/db/001_old.sql"
echo 'select 1;' > "$ROOT/p/db/002_new.sql"
expect "baseline without a final newline: the next file is still checked" mig-01 1
printf '001_old.sql\n009_late.sql' > "$ROOT/p/base.txt"
expect "baseline without a final newline: its last entry is still validated" mig-02 1

project 'migration_pattern: dev2_NNN_name.sql
migrations_from: 198
migrations_baseline: base.txt'
printf 'dev2_198_new.sql\n' > "$ROOT/p/base.txt"
header > "$ROOT/p/db/dev2_198_new.sql"
expect "baseline entry is numbered with migration_pattern, not the first digits" mig-02 1

project 'migration_pattern: dev_NNN_name.sql'
header > "$ROOT/p/db/dev_001_add.sql"
mkdir -p "$ROOT/p/docs/data"; echo '| 001 | add | x |' > "$ROOT/p/docs/data/inventory.md"
expect "registry row matches number and name taken from migration_pattern" mig-02 0

project 'migrations_from: 198
migration_companions: rollback_
migrations_baseline: base.txt'
printf 'rollback_250_bad.sql\n' > "$ROOT/p/base.txt"
expect "a companion in the baseline is numbered too and cannot pass the cutoff" mig-02 1

project 'migrations_from: 198
migration_companions: rollback_'
echo 'create table t (id int);' > "$ROOT/p/db/rollback_197_old.sql"
echo 'create table o (id int);' > "$ROOT/p/db/197_old.sql"
header 'alter table a drop column c;' rollback_197_old.sql > "$ROOT/p/db/198_new.sql"
expect "red: expands cannot name a companion, only a migration" mig-03 1

project 'migrations_from: 198
migration_companions: rollback_
migrations_baseline: base.txt'
printf 'rollback_197_old.sql\n197_old.sql\nrollback_old_misc.sql\n' > "$ROOT/p/base.txt"
echo 'create table t (id int);' > "$ROOT/p/db/rollback_197_old.sql"
echo 'select 1;' > "$ROOT/p/db/197_old.sql"
echo 'select 1;' > "$ROOT/p/db/rollback_old_misc.sql"
header 'alter table a drop column c;' rollback_197_old.sql > "$ROOT/p/db/198_new.sql"
expect "red: a companion in the baseline still cannot be an expands target" mig-03 1
echo '| 198 | new | x |' > "$ROOT/p/docs/inventory.md"; mkdir -p "$ROOT/p/docs/data"; cp "$ROOT/p/docs/inventory.md" "$ROOT/p/docs/data/"
expect "green: legacy companions in the baseline, even off-pattern, stay exempt from MIG-02" mig-02 0

project 'migrations_from: 198
migration_companions: rollback_'
echo 'select 1;' > "$ROOT/p/db/rollback_old_063.sql"
expect "green: an off-pattern legacy companion below migrations_from stays exempt without a baseline" mig-02 0

rm -rf "$ROOT"
echo "mig fixtures: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
