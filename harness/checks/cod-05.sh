HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

check_ui_strings() {
  allowlist="$(docs_dir)/ui-allowlist.txt"
  found=$(src_files | grep -vE "$TEST_RE" | while IFS= read -r file; do
    [ -f "$allowlist" ] && grep -qxF "$file" "$allowlist" && continue
    grep -nE "$UI_STRING_RE" "$file" | cut -d: -f1 | while read -r line; do echo "$file:$line UI text outside the i18n resources"; done
  done)
  [ -z "$found" ] && return 0
  echo "$found"
  return 1
}

each_stack check_ui_strings
exit $?
