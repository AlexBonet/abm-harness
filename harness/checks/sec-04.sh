HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

git rev-parse --git-dir > /dev/null 2>&1 || { echo "not a git repository"; exit 2; }

tracked=$(git ls-files -z | tr '\0' '\n' | grep -E '(^|/)\.claude/' | sed 's/$/: file under .claude\//')
[ -z "$tracked" ] && exit 0
echo "$tracked"
exit 1
