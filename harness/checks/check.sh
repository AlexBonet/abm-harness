HERE=$(cd "$(dirname "$0")" && pwd)
BASE=$(dirname "$HERE")
. "$HERE/lib.sh"

gate=$(lower "${1:-}" | sed 's/Ñ/ñ/')
[ -n "$gate" ] || { echo "usage: check.sh <gate>" >&2; exit 2; }
[ "$gate" = test ] && gate=prueba
[ "$gate" = security ] && gate=seguridad
[ "$gate" = deploy ] && gate=despliegue
[ "$gate" = design ] && gate=diseño
[ "$gate" = diseno ] && gate=diseño

rules=$(awk -F'|' -v gate="$gate" '
  function trim(text) { gsub(/^ +| +$/, "", text); return text }
  $2 ~ /^ *[A-Z]+-[0-9]+ *$/ && tolower(trim($6)) == gate { print trim($2) "|" trim($3) "|" trim($4) }
' "$BASE"/packs/*.md 2>/dev/null)

[ -n "$rules" ] || { echo "no rules for gate $gate"; exit 0; }

report=$(echo "$rules" | while IFS='|' read -r id rule script; do
  if [ ! -f "$HERE/$script" ]; then
    echo "NOT RUN $id $rule"
    echo "  check not installed: $script"
    continue
  fi
  output=$(sh "$HERE/$script" 2>&1 < /dev/null)
  code=$?
  case $code in
    (0) echo "PASS $id $rule" ;;
    (2) echo "NOT RUN $id $rule"; echo "$output" | head -n 20 | sed 's/^/  /' ;;
    (1) echo "FAIL $id $rule"; echo "$output" | head -n 20 | sed 's/^/  /' ;;
    (*) echo "FAIL $id $rule"; echo "  check error (exit $code)" ;;
  esac
done)
echo "$report"
echo "$report" | grep -q '^FAIL ' && exit 1
exit 0
