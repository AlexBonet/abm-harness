#!/bin/sh
HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

usage() {
  echo "review.sh: $1" >&2
  echo "usage: review.sh --coder claude|codex --size small|large [--task <what was asked>] [--claims <what you will tell the owner you did>] [--base <commit>] [--owner-ok]" >&2
  exit 2
}

coder=""
size=""
owner_ok=0
task="(not given)"
claims=""
base_arg=""
while [ $# -gt 0 ]; do
  case $1 in
    --coder) [ $# -ge 2 ] || usage "--coder needs a value"; coder=$2; shift 2 ;;
    --size) [ $# -ge 2 ] || usage "--size needs a value"; size=$2; shift 2 ;;
    --task) [ $# -ge 2 ] || usage "--task needs a value"; task=$2; shift 2 ;;
    --claims) [ $# -ge 2 ] || usage "--claims needs a value"; claims=$2; shift 2 ;;
    --base) [ $# -ge 2 ] || usage "--base needs a value"; base_arg=$2; shift 2 ;;
    --owner-ok) owner_ok=1; shift ;;
    *) usage "unknown argument $1" ;;
  esac
done

case $coder in claude|codex) ;; *) usage "--coder must be claude or codex" ;; esac
case $size in small|large) ;; *) usage "--size must be small or large" ;; esac
in_git || usage "not inside a git repository"
if [ -n "$base_arg" ]; then
  REVIEW_BASE=$(git -C "$PROJECT" rev-parse -q --verify "$base_arg^{commit}") || usage "--base $base_arg is not a commit"
  export REVIEW_BASE
fi

state=$(state_dir)
streak_file="$state/rejected-streak"
findings_file="$state/round1-findings.md"
[ "$owner_ok" -eq 1 ] && rm -f "$streak_file" "$findings_file"
streak=$(cat "$streak_file" 2> /dev/null || echo 0)
case $streak in ''|*[!0-9]*) streak=0 ;; esac
round=$((streak + 1))
if [ "$round" -gt 2 ]; then
  echo "Already rejected twice in a row. Stop and tell the owner which findings remain and why; a new round needs the owner's OK (--owner-ok)."
  exit 3
fi

if ! has_changes; then
  echo "Nothing to review: no changes in $PROJECT."
  exit 0
fi

other() { if [ "$1" = claude ]; then echo codex; else echo claude; fi; }
available() { command -v "$1" > /dev/null 2>&1; }

choice=$(cfg reviewer)
case ${choice:-opposite} in
  opposite) family=$(other "$coder") ;;
  claude|codex) family=$choice ;;
  *) usage "reviewer: in harness.yaml must be opposite, claude or codex (found $choice)" ;;
esac

notes=""
fallback_used=0
if ! available "$family"; then
  available "$(other "$family")" || { echo "No reviewer CLI available (neither claude nor codex). Tell the owner." >&2; exit 2; }
  notes="$family is not available, $(other "$family") reviewed instead."
  family=$(other "$family")
  fallback_used=1
fi

lines=$(changed_lines)
if [ "$size" = small ] && [ "$lines" -gt 150 ]; then
  size=large
  notes="$notes Size raised to large: $lines changed lines."
fi

default_model() {
  case "$1-$2" in
    claude-small) echo haiku ;;
    claude-large) echo sonnet ;;
    codex-small) echo gpt-6-luna ;;
    codex-large) echo gpt-6.1-sol ;;
  esac
}

fp=$(fingerprint)
baseline="$ABMH_DIR/core/AGENT_BASELINE.md"
[ -f "$baseline" ] || baseline="$ABMH_DIR/AGENT_BASELINE.md"

scope="Round 1: a full review. REJECT only for a blocking issue: a broken project rule, a requirement missing or done wrong, a bug, a security hole, data loss, or a coder claim the evidence does not support. List minor issues (naming, style, small cleanups) under a 'Notes:' line; notes do not block an APPROVED."
if [ -n "$claims" ]; then
  claims_text="Coder's claims (what it will tell the owner it did; you have not seen its reasoning): $claims
Check each claim against the diff and anything you can run or read. A claim with no evidence, or one the evidence contradicts, is a finding: quote the claim and say what is missing. Do not accept a claim just because it is stated."
else
  claims_text="Coder's claims: (not given). Judge the diff only."
fi
if [ "$round" -eq 2 ] && [ -f "$findings_file" ]; then
  scope="Round 2: the round-1 verdict and findings are in $findings_file. Check that each round-1 finding is fixed or rejected with a reason that holds. REJECT only for a round-1 finding that is still open, or for a new severe defect: security hole, data loss, broken core behaviour, or part of the task not done. List any other new issue under a 'Notes:' line; notes do not block an APPROVED."
fi

run_family() {
  family=$1
  model=$(cfg "reviewer_${family}_${size}")
  model=${model:-$(default_model "$family" "$size")}
  out="$state/$fp.$family.out"
  log="$state/$fp.$family.log"
  prompt="You are the Reviewer of this project's ABMH harness, with clean context: you have not seen the coder's reasoning. Read $ABMH_DIR/agents/reviewer.md, $ABMH_DIR/gates/review.md and section 8 of $baseline.
Task that was asked: $task
$claims_text
Review every change in this folder since $(base): run 'git diff $(base) -- .', 'git log --oneline $(base)..HEAD' and 'git status --porcelain -- .', and read new untracked files. Read-only: do not edit anything, and do not read secrets (.env files, credentials, keys, auth or token files).
Task size: $size. Review depth: the tier of section 8 that fits the change.
$scope
Reply with the first line exactly APPROVED or REJECTED, with nothing else on it. Lines 2 to 5, in this order and exactly: 'Tier: <pasivo|medio|alto>', 'Diff: $fp', 'Reviewer: $family $model', 'Round: $round'. On REJECTED, add a numbered list of findings with file:line evidence. At most 30 lines."
  rm -f "$out"
  case $family in
    codex)
      ABMH_REVIEWING=1 codex exec -m "$model" -s read-only --skip-git-repo-check -C "$PROJECT" -o "$out" "$prompt" < /dev/null > "$log" 2>&1
      ;;
    claude)
      (cd "$PROJECT" && ABMH_REVIEWING=1 claude -p --model "$model" --add-dir "$ABMH_DIR" --allowedTools "Read Grep Glob Bash(git diff:*) Bash(git status:*) Bash(git log:*) Bash(git show:*) Bash(git ls-files:*)" --disallowedTools "Edit Write NotebookEdit" -- "$prompt" < /dev/null > "$out" 2> "$log")
      ;;
  esac
  verdict=""
  [ -f "$out" ] || return 0
  body=$(tr -d '\r' < "$out")
  line() { printf '%s\n' "$body" | sed -n "${1}p"; }
  first=$(line 1)
  case $first in APPROVED|REJECTED) ;; *) return 0 ;; esac
  case $(line 2) in "Tier: pasivo"|"Tier: medio"|"Tier: alto") ;; *) return 0 ;; esac
  [ "$(line 3)" = "Diff: $fp" ] || return 0
  [ "$(line 4)" = "Reviewer: $family $model" ] || return 0
  [ "$(line 5)" = "Round: $round" ] || return 0
  verdict=$first
}

run_family "$family"
if [ -z "$verdict" ] && [ "$fallback_used" -eq 0 ] && available "$(other "$family")"; then
  notes="$notes $family $model gave no valid verdict (log: $log), $(other "$family") reviewed instead."
  run_family "$(other "$family")"
fi
if [ -z "$verdict" ]; then
  echo "The reviewer ($family $model) gave no valid verdict (first line exactly APPROVED or REJECTED, then Tier, Diff, Reviewer and Round). Output: $out, log: $log. Tell the owner." >&2
  exit 2
fi

record="$state/$fp.md"
{
  echo "Verdict: $verdict"
  echo "Diff: $fp"
  echo "Reviewer: $family $model"
  echo "Size: $size ($lines changed lines)"
  echo "Round: $round"
  [ -n "$notes" ] && echo "Notes: $(echo "$notes" | sed 's/^ *//')"
  echo "---"
  cat "$out"
} > "$record"
cat "$record"
echo

if [ "$verdict" = APPROVED ]; then
  rm -f "$streak_file" "$findings_file"
  echo "APPROVED: tell the owner and close the task."
  exit 0
fi
echo "$round" > "$streak_file"
[ "$round" -eq 1 ] && cp "$record" "$findings_file"
if [ "$round" -ge 2 ]; then
  echo "Second REJECTED in a row. Stop: tell the owner which findings remain and why they could not be fixed. No new round without the owner (--owner-ok)."
else
  echo "First REJECTED: check each finding against the code, fix what holds, then run review.sh again. Round 2 checks these findings and blocks only on an open one or a new severe defect."
fi
exit 1
