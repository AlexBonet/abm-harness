HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/mig-lib.sh"

DESTRUCTIVE='drop[[:space:]]+(column|table)|alter[[:space:]]+(column[[:space:]]+)?[A-Za-z0-9_".]+[[:space:]]+(set[[:space:]]+data[[:space:]]+)?type[[:space:]]'
ADDS='add[[:space:]]+column|create[[:space:]]+table'

mig_load_matching || exit 2
found=$(mig_new | while IFS= read -r name; do
  flat_sql "$MIG_DIR/$name" | grep -qiE "$DESTRUCTIVE" || continue
  expands=$(mig_field "$(mig_header "$MIG_DIR/$name")" expands)
  number=$(echo "$MIG_ROWS" | awk -F'\t' -v name="$name" '$3 == name { print $2 }')
  earlier=$(echo "$MIG_ROWS" | awk -F'\t' -v name="$expands" -v number="$number" '$3 == name && $2 < number { print $3 }')
  if [ -z "$expands" ]; then
    echo "$name: drops or retypes a column or table; the header needs -- expands: <earlier migration that added the replacement>"
  elif [ -z "$earlier" ] || ! flat_sql "$MIG_DIR/$earlier" | grep -qiE "$ADDS"; then
    echo "$name: expands: $expands is not an earlier migration that adds a column or table"
  fi
done)
[ -z "$found" ] && exit 0
echo "$found"
exit 1
