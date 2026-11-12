HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

git rev-parse --git-dir > /dev/null 2>&1 || { echo "not a git repository"; exit 2; }
[ -s "$HERE/sec-patterns.txt" ] || { echo "sec-patterns.txt is missing or empty, nothing can be checked"; exit 2; }

allowlist="$(docs_dir)/secrets-allowlist.txt"
bad=""
entries=""
if [ -f "$allowlist" ]; then
  bad=$(awk -F'|' '/^[[:space:]]*(#|$)/ { next } { reason = $2; gsub(/[[:space:]]/, "", reason); if (reason == "") print FILENAME ":" NR " entry without a reason exempts nothing" }' "$allowlist")
  entries=$(awk -F'|' '/^[[:space:]]*(#|$)/ { next } { reason = $2; gsub(/[[:space:]]/, "", reason); path = $1; gsub(/^[[:space:]]+|[[:space:]]+$/, "", path); if (reason != "") print path }' "$allowlist")
fi

listed=$(git -c core.quotePath=false ls-files -z -co --exclude-standard | tr '\0' '\n' | grep -v '^\.abmh/' | LIST="$entries" awk '
  BEGIN { count = split(ENVIRON["LIST"], allowed, "\n") }
  { skip = 0; for (i = 1; i <= count; i++) if ($0 == allowed[i] || (allowed[i] ~ /\/$/ && index($0, allowed[i]) == 1)) skip = 1; if (!skip) print }
') || { echo "the file list could not be built"; exit 2; }
files=$(echo "$listed" | while IFS= read -r file; do
  [ -f "$file" ] && [ ! -L "$file" ] && echo "$file"
done)

envs=$(echo "$files" | grep -E '(^|/)\.env(\.[^/]*)?$' | grep -vE '\.(example|sample|template|dist)$' | sed 's/$/: committed env file/')

hits=""
while IFS= read -r line; do
  name=${line%%:*}
  regex=${line#*:}
  flags=-IE
  [ "$name" = generic-secret ] && flags=-iIE
  matching=$(echo "$files" | tr '\n' '\0' | xargs -0 grep -l $flags -- "$regex" 2> /dev/null)
  [ -n "$matching" ] || continue
  hits="$hits$(echo "$matching" | while IFS= read -r file; do
    grep -n $flags -- "$regex" "$file" 2> /dev/null | cut -d: -f1 | while IFS= read -r number; do
      printf '%s:%s %s\n' "$file" "$number" "$name"
    done
  done)
"
done < "$HERE/sec-patterns.txt"

found=$(printf '%s\n%s\n%s\n' "$bad" "$envs" "$hits" | sed '/^$/d')
[ -z "$found" ] && exit 0
echo "$found"
exit 1
