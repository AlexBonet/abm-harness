HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

git rev-parse --git-dir > /dev/null 2>&1 || { echo "not a git repository"; exit 2; }
hooks_path=$(git config --get core.hooksPath)
case "$hooks_path" in
  (.abmh/hooks|*/.abmh/hooks) exit 0 ;;
esac
if [ -f "$ABMH_DIR/manifest.json" ] && grep -q 'core.hooksPath' "$ABMH_DIR/manifest.json"; then
  echo "the harness hook was installed but core.hooksPath no longer points to .abmh/hooks"
  exit 1
fi
[ -x "$(git rev-parse --git-path hooks/pre-push)" ] && exit 0
echo "no pre-push hook is active (skipped, or the repository has its own hooks)"
exit 2
