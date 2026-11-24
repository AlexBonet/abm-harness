HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

git rev-parse --git-dir > /dev/null 2>&1 || { echo "not a git repository"; exit 2; }
base=${ABMH_BASE:-HEAD}
git rev-parse --verify -q "$base" > /dev/null || { echo "no base revision to compare"; exit 2; }
cr=$(printf '\r')

crlf_lines() {
  grep -c "$cr\$" || true
}

changed=$(git -c core.quotePath=false diff --name-only --relative --diff-filter=M "$base" | grep -v '^\.abmh/')
found=""
while IFS= read -r file; do
  [ -n "$file" ] && [ -f "$file" ] || continue
  grep -Iq . "$file" 2> /dev/null || continue
  before=$(git show "$base:./$file" 2> /dev/null | crlf_lines)
  after=$(crlf_lines < "$file")
  if [ "$before" -gt 0 ] && [ "$after" -eq 0 ]; then
    found="$found$file: line endings changed from CRLF to LF\n"
  elif [ "$before" -eq 0 ] && [ "$after" -gt 0 ]; then
    found="$found$file: line endings changed from LF to CRLF\n"
  fi
done <<LIST
$changed
LIST
[ -z "$found" ] && exit 0
printf '%b' "$found"
exit 1
