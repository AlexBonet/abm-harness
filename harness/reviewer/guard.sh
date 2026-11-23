#!/bin/sh
HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

input=$(cat)
[ -n "${ABMH_REVIEWING:-}" ] && exit 0
in_git || exit 0

session=$(printf '%s' "$input" | sed -n 's/.*"session_id" *: *"\([^"]*\)".*/\1/p' | head -n 1 | tr -cd 'A-Za-z0-9_-')
state=$(state_dir)
if has_changes; then fp=$(fingerprint); else fp=clean; fi

case ${1:-} in
  session-start)
    [ -n "$session" ] && [ ! -f "$state/session-$session" ] && printf '%s\n' "$fp" > "$state/session-$session"
    exit 0
    ;;
  stop)
    printf '%s' "$input" | grep -q '"stop_hook_active" *: *true' && exit 0
    [ "$fp" = clean ] && exit 0
    [ -n "$session" ] && [ -f "$state/session-$session" ] && [ "$(cat "$state/session-$session")" = "$fp" ] && exit 0
    [ -f "$state/$fp.md" ] && exit 0
    where=$(printf '%s' "$ABMH_DIR" | tr '\n\r\t' '   ' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '{"decision":"block","reason":"ABMH Revision gate: this session changed files and the current diff (%s) has no Reviewer verdict. If the task is done, run: sh %s/reviewer/review.sh --coder claude --size small|large --task <what was asked> --claims <what you will tell the owner you did>. APPROVED closes; first REJECTED: fix and run it again; second REJECTED: stop and tell the owner why. If you are mid-task or waiting for the owner, say so in one line and stop."}\n' "$fp" "$where"
    exit 0
    ;;
esac
exit 0
