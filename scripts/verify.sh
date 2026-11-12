#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

fail=0

banned="$(grep -rnE '(^|[^A-Za-z0-9_-])n(p)(m|x)([^A-Za-z0-9_-]|$)' --include='*.mjs' --include='*.sh' --include='*.json' --include='pre-push' --exclude-dir=.git --exclude-dir=node_modules . || true)"
if [ -n "$banned" ]; then
  echo "verify: executable files call the banned package runner:" >&2
  echo "$banned" >&2
  fail=1
fi

long="$(find bin src scripts tests -name '*.mjs' -exec wc -l {} + | awk '$2 != "total" && $1 > 300 { print $2 " (" $1 " lines)" }')"
if [ -n "$long" ]; then
  echo "verify: files over 300 lines:" >&2
  echo "$long" >&2
  fail=1
fi

comments="$(grep -rnE '^[[:space:]]*(//|/\*)' --include='*.mjs' bin src scripts tests || true)"
if [ -n "$comments" ]; then
  echo "verify: code comments found:" >&2
  echo "$comments" >&2
  fail=1
fi

rooted="$(grep -rnE '000-ABM[S]|/User[s]/' bin src scripts tests harness || true)"
if [ -n "$rooted" ]; then
  echo "verify: files depend on the ABMS root or a home path:" >&2
  echo "$rooted" >&2
  fail=1
fi

sync_code=0
node scripts/sync.mjs --check || sync_code=$?
case "$sync_code" in
  0) ;;
  3) echo "verify: sync --check NOT RUN (no ABMS root next to this repo); it does not count as OK" >&2 ;;
  *) fail=1 ;;
esac

node --test tests/*.test.mjs || fail=1

if [ "$fail" -ne 0 ]; then
  echo "verify: FAILED" >&2
  exit 1
fi
echo "verify: OK"
