HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

check_any() {
  found=$(src_files | while IFS= read -r file; do
    grep -nE "$ANY_RE" "$file" | grep -vE "$ANY_ALLOWED_RE" | cut -d: -f1 | while read -r line; do echo "$file:$line any type"; done
  done)
  [ -z "$found" ] && return 0
  echo "$found"
  return 1
}

each_stack check_any
exit $?
