HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/mig-lib.sh"

mig_load || exit 2
registry=$(cfg_or migrations_registry "$(docs_dir)/data")
order=$(echo "$MIG_ROWS" | awk -F'\t' '$1 == "NEW"' | sort -t "$(printf '\t')" -k2,2n -k3,3)
off=$(echo "$MIG_ROWS" | awk -F'\t' -v pattern="$MIG_PATTERN" '$1 == "BAD" { print $3 ": does not follow the pattern " pattern }')
series=$(echo "$order" | awk -F'\t' -v from="$MIG_FROM" '
  $1 != "NEW" { next }
  $2 < from { print $3 ": numbered below " from " but not in the baseline; new migrations start at " from; next }
  $4 != "-" { if (seen[$4, $2]++) print $3 ": number " $2 " is repeated in family " $4; next }
  $2 == last { print $3 ": number " $2 " is repeated"; next }
  $2 > expected { print $3 ": expected number " expected }
  { last = $2; expected = $2 + 1 }
  BEGIN { expected = from; last = -1 }
')
orphans=$(echo "$MIG_ROWS" | awk -F'\t' '
  $1 == "COMP" { companion[$2] = companion[$2] " " $3; next }
  $1 == "NEW" || $1 == "OLD" { known[$2] = 1 }
  END { for (number in companion) if (!(number in known)) print substr(companion[number], 2) ": companion without a migration numbered " number }
')
listed=$(echo "$MIG_ROWS" | awk -F'\t' '$1 == "NEW" { print $3 "\t" $5 "\t" $6 }' | while IFS="$(printf '\t')" read -r name digits stem; do
  grep -rwqF --include='*.md' -- "$name" "$registry" 2> /dev/null && continue
  grep -rhwF --include='*.md' -- "$stem" "$registry" 2> /dev/null | awk -F'|' -v digits="$digits" -v stem="$stem" '
    function word(text, token,    at, before, after) {
      at = index(text, token)
      while (at > 0) {
        before = at == 1 ? " " : substr(text, at - 1, 1)
        after = substr(text, at + length(token), 1)
        if (before !~ /[A-Za-z0-9_]/ && after !~ /[A-Za-z0-9_]/) return 1
        text = substr(text, at + 1)
        at = index(text, token)
      }
      return 0
    }
    word($2, digits) && word($3, stem) { found = 1 }
    END { exit !found }
  ' || echo "$name: not listed in $registry/ (a .md there names the file or a row has number $digits and name $stem)"
done)
oversized=$(echo "$MIG_ROWS" | awk -F'\t' -v from="$MIG_FROM" '$1 == "BASE" && $2 >= from { print $3 ": the baseline cannot cover a migration numbered " from " or higher" }')
found=$(printf '%s\n%s\n%s\n%s\n%s\n' "$off" "$series" "$listed" "$oversized" "$orphans" | sed '/^$/d')
[ -z "$found" ] && exit 0
echo "$found"
exit 1
