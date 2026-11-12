HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

command=$(cfg design_check)
[ -n "$command" ] || { echo "no design_check: command in harness.yaml (contrast, focus, reduced motion)"; exit 2; }
output=$(sh -c "$command" 2>&1 < /dev/null)
code=$?
case $code in
  (0) exit 0 ;;
  (127) echo "design_check command not found: $command"; exit 2 ;;
esac
echo "$output" | tail -n 20
exit 1
