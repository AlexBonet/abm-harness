HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/dep-lib.sh"

docs_or_exit
found=$(fields_report "$docs/RELEASE.md" "Touches" "Could break" "Rollback" "Post-check")
[ -z "$found" ] && exit 0
echo "$found"
exit 1
