HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/mig-lib.sh"

SENSITIVE='(create|alter|drop)[[:space:]]+policy|grant[[:space:]]|revoke[[:space:]]|row[[:space:]]+level[[:space:]]+security|default[[:space:]]+privileges'

git rev-parse --git-dir > /dev/null 2>&1 || { echo "not a git repository"; exit 2; }
mig_load_matching || exit 2
changed=$(changed_files)
found=$({ mig_new; echo "$MIG_ROWS" | awk -F'\t' '$1 == "COMP" { print $3 }'; } | while IFS= read -r name; do
  echo "$changed" | grep -qxF "$MIG_DIR/$name" || continue
  flat_sql "$MIG_DIR/$name" | grep -qiE "$SENSITIVE" && echo "Seguridad gate and tier alto required: $MIG_DIR/$name"
done)
[ -z "$found" ] && exit 0
echo "$found"
exit 2
