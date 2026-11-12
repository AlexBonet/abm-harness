HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

[ "$(cfg web)" = true ] || { echo "web: true is not declared in harness.yaml, nothing to judge"; exit 2; }
[ -n "$(cfg staging)" ] && exit 0
echo "web: true needs a staging: line in harness.yaml"
exit 1
