HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

check_comments() {
  if web_syntax_enabled; then check_web_code COD-03; return $?; fi
  found=$(src_files | while IFS= read -r file; do
    grep -nE "$COMMENT_RE" "$file" | grep -vE "$DIRECTIVE_RE" | cut -d: -f1 | while read -r line; do echo "$file:$line code comment"; done
  done)
  [ -z "$found" ] && return 0
  echo "$found"
  return 1
}

each_stack check_comments
exit $?
