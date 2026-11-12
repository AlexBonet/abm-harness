HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

docs=$(docs_dir)
[ -d "$docs" ] || { echo "docs folder $docs not found"; exit 2; }
found=""
[ -f "$docs/ROTATION.md" ] || found="$docs/ROTATION.md is missing (what is rotated, where each secret lives, the steps, who is told)"
if git rev-parse --git-dir > /dev/null 2>&1; then
  hook=$(git rev-parse --git-path hooks/pre-push)
  if [ -x "$hook" ] && ! grep -q 'sec-01' "$hook"; then
    found="$found
the active pre-push hook does not run sec-01 ($hook)"
  fi
fi
found=$(echo "$found" | sed '/^$/d')
[ -z "$found" ] && exit 0
echo "$found"
exit 1
