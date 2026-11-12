HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

check_tests_touched() {
  git rev-parse --git-dir > /dev/null 2>&1 || { echo "not a git repository"; return 2; }
  changed=$(changed_files)
  pattern="\\.($(echo "$EXT" | tr ' ' '|'))\$"
  changed=$(echo "$changed" | grep -v '^\.abmh/' | grep -E "$pattern")
  sources=$(echo "$changed" | grep -vE "$TEST_RE")
  [ -n "$sources" ] || return 0
  echo "$changed" | grep -qE "$TEST_RE" && return 0
  echo "$(echo "$sources" | wc -l | tr -d ' ') source files changed and no test file changed"
  return 1
}

each_stack check_tests_touched
exit $?
