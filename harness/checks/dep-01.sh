HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

text=""
for file in .github/workflows/*.yml .github/workflows/*.yaml; do
  [ -f "$file" ] && text="$text$(cat "$file")
"
done
[ -n "$text" ] || { echo "no workflow in .github/workflows"; exit 1; }
text=$(printf '%s\n' "$text" | tr -d '\r' | sed 's/[[:space:]]#.*$//' | grep -vE '^[[:space:]]*(#|-[[:space:]]+name:|name:|runs-on:|[A-Za-z0-9_-]+:[[:space:]]*$)')
W='(^|[^[:alnum:]])'
E='([^[:alnum:]]|$)'
missing=""
printf '%s\n' "$text" | grep -qiE "${W}(lint|eslint|ktlint|detekt)" || missing="$missing lint"
printf '%s\n' "$text" | grep -qiE "${W}(tsc|typecheck|type-check|astro check|compile[a-z]*)${E}" || missing="$missing types"
printf '%s\n' "$text" | grep -qiE "${W}(test|tests|vitest|jest|pytest)" || missing="$missing tests"
printf '%s\n' "$text" | grep -qF 'verify.sh' || missing="$missing verify.sh"
[ -z "$missing" ] && exit 0
for item in $missing; do echo "missing: $item"; done
exit 1
