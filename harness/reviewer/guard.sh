#!/bin/sh
HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

input=$(cat)
[ -n "${ABMH_REVIEWING:-}" ] && exit 0
in_git || exit 0

session=$(session_of "$input")
state=$(state_dir)
track="$state/track-$session"
digest() { [ -n "$1" ] && printf '%s\n' "$1" | shasum -a 256 | cut -c1-12; }

case ${1:-} in
  session-start)
    list=$(changed_files | counted)
    fp=$(digest "$list") || fp=clean
    [ -n "$session" ] && [ ! -f "$state/session-$session" ] && printf '%s\n' "$fp" > "$state/session-$session"
    exit 0
    ;;
  stop)
    printf '%s' "$input" | grep -q '"stop_hook_active" *: *true' && exit 0
    if [ -n "$session" ] && [ -f "$track" ]; then
      list=$(counted < "$track")
      [ -n "$list" ] || exit 0
    else
      list=$(changed_files | counted)
      [ -n "$list" ] || exit 0
      [ -n "$session" ] && [ -f "$state/session-$session" ] && [ "$(cat "$state/session-$session")" = "$(digest "$list")" ] && exit 0
    fi
    fp=$(digest "$list")
    [ -f "$state/reviewed" ] && [ -z "$(printf '%s\n' "$list" | grep -Fxv -f "$state/reviewed")" ] && exit 0
    where=$(printf '%s' "$ABMH_DIR" | tr '\n\r\t' '   ' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '{"decision":"block","reason":"ABMH Revision gate: this session changed code or config (%s) with no Reviewer verdict. If the task is done, run: sh %s/reviewer/review.sh --coder claude --size small|large --task <what was asked> --claims <what you will tell the owner you did>. APPROVED closes; first REJECTED: fix and run it again; second REJECTED: stop and tell the owner why. If you are mid-task or waiting for the owner, say so in one line and stop."}\n' "$fp" "$where"
    exit 0
    ;;
esac
exit 0
