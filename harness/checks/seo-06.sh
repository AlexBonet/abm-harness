HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/seo-lib.sh"

one_h1() {
  count=$(printf '%s\n' "$1" | grep -oiE '<h1[[:space:]>]' | wc -l | tr -d ' ')
  [ "$count" -eq 1 ]
}

seo_run one_h1 "needs exactly one H1"
