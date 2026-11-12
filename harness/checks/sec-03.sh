HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

git rev-parse --git-dir > /dev/null 2>&1 || { echo "not a git repository"; exit 2; }
git rev-parse --verify -q HEAD > /dev/null 2>&1 || { echo "no commits to scan"; exit 2; }
[ "$(git rev-parse --is-shallow-repository)" = true ] && { echo "shallow clone: the history is incomplete, fetch it all (fetch-depth: 0)"; exit 2; }

[ -s "$HERE/sec-patterns.txt" ] || { echo "sec-patterns.txt is missing or empty, nothing can be checked"; exit 2; }

work=$(mktemp -d) || { echo "no temporary folder"; exit 2; }
trap 'rm -rf "$work"' EXIT

git -c core.quotePath=false log --all -p -m -U0 --text --no-textconv --no-color --no-ext-diff --format='@@commit %h' > "$work/log" 2> /dev/null || { echo "git log failed, the history was not read"; exit 2; }
awk -v meta="$work/meta" -v body="$work/body" '
  /^@@commit / { commit = $2; hunk = 0; file = ""; next }
  /^diff --git / { hunk = 0; file = ""; next }
  hunk == 0 && /^\+\+\+ / { file = ($0 == "+++ /dev/null") ? "" : substr($0, 7); sub(/\t.*$/, "", file); next }
  /^@@ / { hunk = 1; next }
  hunk == 1 && /^\+/ && file != "" { print commit "\t" file > meta; print substr($0, 2) > body }
' "$work/log"
[ -s "$work/body" ] || exit 0

entries=$(allow_entries)
hits=""
while IFS= read -r line; do
  name=${line%%:*}
  regex=${line#*:}
  flags=-aE
  [ "$name" = generic-secret ] && flags=-aiE
  hits="$hits$(grep -n $flags -- "$regex" "$work/body" 2> /dev/null | cut -d: -f1 | while IFS= read -r number; do
    printf '%s\t%s\n' "$(sed -n "${number}p" "$work/meta")" "$name"
  done)
"
done < "$HERE/sec-patterns.txt"

found=$(printf '%s' "$hits" | sort -u | ENTRIES="$entries" awk -F'\t' '
  BEGIN { count = split(ENVIRON["ENTRIES"], allowed, "\n") }
  NF < 3 || index($2, ".abmh/") == 1 { next }
  { skip = 0; for (i = 1; i <= count; i++) if (allowed[i] != "" && ($2 == allowed[i] || (allowed[i] ~ /\/$/ && index($2, allowed[i]) == 1))) skip = 1; if (!skip) print $1 ":" $2 " " $3 }
')
[ -z "$found" ] && exit 0
echo "$found"
exit 1
