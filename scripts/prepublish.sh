#!/bin/sh
repo=.
email=""
deny=""
while [ $# -gt 0 ]; do
  case "$1" in
    --email) email=${2:-}; shift 2 ;;
    --deny-file) deny=${2:-}; shift 2 ;;
    *) repo=$1; shift ;;
  esac
done

[ -z "$deny" ] || deny=$(cd "$(dirname "$deny")" 2> /dev/null && pwd)/$(basename "$deny")
cd "$repo" 2> /dev/null || { echo "NOT RUN: $repo is not a folder"; exit 2; }
git rev-parse --git-dir > /dev/null 2>&1 || { echo "NOT RUN: not a git repository"; exit 2; }
git rev-parse --verify -q HEAD > /dev/null 2>&1 || { echo "NOT RUN: no commits"; exit 2; }
[ "$(git rev-parse --is-shallow-repository)" = true ] && { echo "NOT RUN: shallow clone, the history is incomplete"; exit 2; }
[ -z "$deny" ] || [ -f "$deny" ] || { echo "NOT RUN: deny file $deny not found"; exit 2; }

top=$(pwd)
work=$(mktemp -d) || { echo "NOT RUN: no temporary folder"; exit 2; }
trap 'rm -rf "$work"' EXIT
failed=0
notrun=0
PERSONAL='/Use[r]s/[A-Za-z]|000-ABM[S]'

report() {
  if [ -z "$2" ]; then echo "PASS $1"; else echo "FAIL $1"; echo "$2" | head -n 20 | sed 's/^/  /'; failed=1; fi
}

run_check() {
  script="$top/harness/checks/$2"
  [ -f "$script" ] || { echo "NOT RUN $1 ($2 is missing)"; notrun=1; return; }
  output=$(ABMH_DIR="$top/harness" sh "$script" < /dev/null 2>&1)
  case $? in
    0) report "$1" "" ;;
    2) echo "NOT RUN $1"; echo "$output" | head -n 5 | sed 's/^/  /'; notrun=1 ;;
    *) report "$1" "$output" ;;
  esac
}

git -c core.quotePath=false log --all -p -m -U0 --text --no-textconv --no-color --no-ext-diff --format='@@commit %h' > "$work/log" 2> /dev/null || { echo "NOT RUN: git log failed"; exit 2; }
awk '
  /^@@commit / { commit = $2; hunk = 0; file = ""; next }
  /^diff --git / { hunk = 0; file = ""; next }
  hunk == 0 && /^\+\+\+ / { file = ($0 == "+++ /dev/null") ? "" : substr($0, 7); sub(/\t.*$/, "", file); next }
  /^@@ / { hunk = 1; next }
  hunk == 1 && /^\+/ && file != "" { print commit ":" file "\t" substr($0, 2) }
' "$work/log" > "$work/added"
untracked() { git -c core.quotePath=false ls-files -co --exclude-standard; }

run_check "secrets in the tree" sec-01.sh
run_check "secrets in the history" sec-03.sh

paths=$(awk -v re="$PERSONAL" '{ tab = index($0, "\t"); if (substr($0, tab + 1) ~ re) print substr($0, 1, tab - 1) }' "$work/added" | sort -u)
messages=$(git log --all --format='%h %s %an' | grep -E "$PERSONAL" | cut -d' ' -f1)
files=$(untracked | tr '\n' '\0' | xargs -0 grep -lIE "$PERSONAL" 2> /dev/null | sed 's/^/tree:/')
report "personal paths" "$(printf '%s\n%s\n%s\n' "$paths" "$messages" "$files" | sed '/^$/d')"

if [ -n "$email" ]; then
  domain=$(printf '%s' "$email" | sed 's/[.]/\\./g')
  report "author emails" "$(git log --all --format='%ae%n%ce' | sort -u | grep -vE "@${domain}\$")"
else
  echo "NOT RUN author emails (pass --email <allowed domain>)"; notrun=1
fi

if [ -n "$deny" ]; then
  names=$(grep -iwFf "$deny" "$work/added" | cut -f1 | sort -u)
  said=$(git log --all --format='%h %s %an %ae' | grep -iwFf "$deny" | cut -d' ' -f1)
  tree=$(untracked | tr '\n' '\0' | xargs -0 grep -liIwFf "$deny" 2> /dev/null | sed 's/^/tree:/')
  report "private names" "$(printf '%s\n%s\n%s\n' "$names" "$said" "$tree" | sed '/^$/d')"
else
  echo "NOT RUN private names (pass --deny-file <file outside the repo>)"; notrun=1
fi

blobs=$(git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' | awk '$1 == "blob" && $2 > 1048576 { $1 = ""; $2 = ""; print "history: " $0 " over 1 MB" }')
loose=$(untracked | while IFS= read -r file; do [ -f "$file" ] && [ "$(wc -c < "$file")" -gt 1048576 ] && echo "$file: over 1 MB"; done)
report "big files" "$(printf '%s\n%s\n' "$blobs" "$loose" | sed '/^$/d')"

envs=$(git -c core.quotePath=false log --all --name-only --format= | sort -u | grep -E '(^|[/"])\.env(\.[^/]*)?"?$' | grep -vE '\.(example|sample|template|dist)"?$')
report "env files" "$envs"

[ "$failed" -ne 0 ] && exit 1
[ "$notrun" -ne 0 ] && exit 2
exit 0
