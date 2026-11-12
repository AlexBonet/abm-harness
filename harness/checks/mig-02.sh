HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/mig-lib.sh"

mig_load || exit 2
registry="$(docs_dir)/data"
order=$(echo "$MIG_ROWS" | awk -F'\t' '$1 == "NEW"' | sort -t "$(printf '\t')" -k2,2n -k3,3)
off=$(echo "$MIG_ROWS" | awk -F'\t' -v pattern="$MIG_PATTERN" '$1 == "BAD" { print $3 ": does not follow the pattern " pattern }')
series=$(echo "$order" | awk -F'\t' -v from="$MIG_FROM" '
  $1 != "NEW" { next }
  $2 == last { print $3 ": number " $2 " is repeated"; next }
  $2 > expected { print $3 ": expected number " expected }
  { last = $2; expected = $2 + 1 }
  BEGIN { expected = from; last = -1 }
')
listed=$(mig_new | while IFS= read -r name; do
  grep -rwqF --include='*.md' -- "$name" "$registry" 2> /dev/null || echo "$name: not listed in $registry/ (a .md there names every migration)"
done)
found=$(printf '%s\n%s\n%s\n' "$off" "$series" "$listed" | sed '/^$/d')
[ -z "$found" ] && exit 0
echo "$found"
exit 1
