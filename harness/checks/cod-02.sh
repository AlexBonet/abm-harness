HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

check_length() {
  if web_syntax_enabled; then check_web_code COD-02; return $?; fi
  found=$(src_files | while IFS= read -r file; do
    lines=$(wc -l < "$file" | tr -d ' ')
    [ "$lines" -gt 300 ] && echo "$file:$lines more than 300 lines"
  done)
  [ -z "$found" ] && return 0
  echo "$found"
  return 1
}

each_stack check_length
exit $?
