HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

docs=$(docs_dir)
[ -d "$docs" ] || { echo "docs folder $docs not found"; exit 2; }
today=${ABMH_TODAY:-$(date +%Y-%m-%d)}

day_number() {
  echo "$1" | awk -F- '{ y = $1; m = $2; if (m < 3) { y--; m += 12 } print int(365.25 * y) + int(30.6001 * (m + 1)) + $3 }'
}

found=$(for name in STATUS LEEME; do
  file="$docs/$name.md"
  [ -f "$file" ] || continue
  date=$(grep -m 1 -oE '(Last reviewed|Última revisión): *[0-9]{4}-[0-9]{2}-[0-9]{2}' "$file" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}$')
  if [ -z "$date" ]; then
    grep -qE '(Last reviewed|Última revisión):' "$file" && echo "NOTRUN $file: Last reviewed is not filled in yet" || echo "FAIL $file: no Last reviewed line"
    continue
  fi
  age=$(( $(day_number "$today") - $(day_number "$date") ))
  [ "$age" -gt 30 ] || continue
  git rev-parse --git-dir > /dev/null 2>&1 || { echo "NOTRUN $file: reviewed $age days ago and there is no git to count commits"; continue; }
  [ -n "$(git log --since="$date 23:59:59" --format=%h -n 1)" ] && echo "FAIL $file: last reviewed $date, $age days ago, with commits since"
done)
echo "$found" | grep -q '^FAIL' && { echo "$found" | grep '^FAIL' | sed 's/^FAIL //'; exit 1; }
echo "$found" | grep -q '^NOTRUN' && { echo "$found" | grep '^NOTRUN' | sed 's/^NOTRUN //'; exit 2; }
exit 0
