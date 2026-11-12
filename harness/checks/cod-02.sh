HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

check_length() {
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
