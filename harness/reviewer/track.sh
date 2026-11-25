#!/bin/sh
HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

input=$(cat)
[ -n "${ABMH_REVIEWING:-}" ] && exit 0
in_git || exit 0
session=$(session_of "$input")
[ -n "$session" ] || exit 0
tool=$(json_field "$input" tool_name)

record() {
  case $1 in /*) abs=$1 ;; *) abs="$(pwd)/$1" ;; esac
  dir=$(cd "$(dirname "$abs")" 2> /dev/null && pwd -P) || return 0
  PROJECT=$(git -C "$dir" rev-parse --show-toplevel 2> /dev/null) || return 0
  rel=${dir#"$PROJECT"}
  rel=${rel#/}
  printf '%s\n' "${rel:+$rel/}$(basename "$abs")" >> "$(state_dir)/track-$session"
}

state=$(state_dir)
call=$(json_field "$input" tool_use_id | tr -cd 'A-Za-z0-9_-')
mark="$state/mark-$session${call:+-$call}"
case ${1:-} in
  pre)
    [ -f "$state/track-$session" ] || : > "$state/track-$session"
    [ "$tool" = Bash ] && changed_files | hashed > "$mark"
    ;;
  post)
    case $tool in
      Bash)
        [ -f "$mark" ] || exit 0
        changed_files | hashed | grep -Fxv -f "$mark" | sed 's/ [^ ]*$//' >> "$state/track-$session"
        rm -f "$mark"
        ;;
      Edit|Write|MultiEdit|NotebookEdit)
        file=$(json_field "$input" file_path)
        [ -n "$file" ] || file=$(json_field "$input" notebook_path)
        [ -n "$file" ] && record "$file"
        ;;
    esac
    ;;
esac
exit 0
