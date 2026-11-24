HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

git rev-parse --git-dir > /dev/null 2>&1 || { echo "not a git repository"; exit 2; }
base=${ABMH_BASE:-HEAD}
git rev-parse --verify -q "$base" > /dev/null || { echo "no base revision to compare"; exit 2; }
cr=$(printf '\r')

endings() {
  text=$(cat; printf x)
  newlines=$(printf '%s' "$text" | tr -cd '\n' | wc -c | tr -d ' ')
  crlf=$(printf '%s' "$text" | grep -c "$cr\$" || true)
  if [ "$crlf" -eq 0 ]; then echo LF
  elif [ "$crlf" -ge "$newlines" ]; then echo CRLF
  else echo mixed
  fi
}

changed=$(git -c core.quotePath=false diff --name-only --relative --diff-filter=M "$base" | grep -v '^\.abmh/')
found=""
while IFS= read -r file; do
  [ -n "$file" ] && [ -f "$file" ] || continue
  grep -Iq . "$file" 2> /dev/null || continue
  before=$(git cat-file --filters "$base:./$file" 2> /dev/null | endings)
  after=$(endings < "$file")
  [ "$before" = mixed ] || [ "$before" = "$after" ] || found="$found$file: line endings changed from $before to $after\n"
done <<LIST
$changed
LIST
[ -z "$found" ] && exit 0
printf '%b' "$found"
exit 1
