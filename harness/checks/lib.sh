ABMH_DIR=${ABMH_DIR:-$(dirname "$HERE")}

cd "$ABMH_DIR/.." || exit 2

cfg() {
  [ -f "$ABMH_DIR/harness.yaml" ] && sed -n "s/^$1: *//p" "$ABMH_DIR/harness.yaml" | head -n 1 | tr -d '\r' | sed -e 's/[[:space:]]*#.*$//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

cfg_or() {
  value=$(cfg "$1")
  echo "${value:-$2}"
}

docs_dir() {
  cfg_or docsDir 00-docs
}

lower() {
  echo "$1" | tr 'A-Z' 'a-z'
}

src_files() {
  set --
  for ext in $EXT; do
    [ $# -gt 0 ] && set -- "$@" -o
    set -- "$@" -name "*.$ext"
  done
  find . \( -name node_modules -o -name .git -o -name build -o -name dist -o -name .gradle -o -name .abmh -o -name .astro \) -prune -o -type f \( "$@" \) -print | sed 's|^\./||' | sort
}

each_stack() {
  seen=0
  passed=0
  failed=0
  for file in "$HERE"/stack/*.sh; do
    [ -f "$file" ] || continue
    seen=$((seen + 1))
    ( . "$file"; "$@" )
    case $? in
      0) passed=$((passed + 1)) ;;
      2) ;;
      *) failed=$((failed + 1)) ;;
    esac
  done
  [ "$seen" -gt 0 ] || { echo "no stack installed (stack pending)"; return 2; }
  [ "$failed" -eq 0 ] || return 1
  [ "$passed" -gt 0 ] || return 2
  return 0
}

changed_files() {
  base=${ABMH_BASE:-HEAD}
  if git rev-parse --verify -q "$base" > /dev/null; then
    { git -c core.quotePath=false diff --name-only --relative "$base"; git -c core.quotePath=false ls-files --others --exclude-standard; } | sort -u
  else
    git -c core.quotePath=false ls-files --cached --others --exclude-standard | sort -u
  fi
}

flat_sql() {
  tr -d '\r' < "$1" | sed 's/--.*$//' | tr '\n' ' ' | sed 's|/\*[^*]*\*/||g'
}

allow_entries() {
  allowlist="$(docs_dir)/secrets-allowlist.txt"
  [ -f "$allowlist" ] || return 0
  awk -F'|' '/^[[:space:]]*(#|$)/ { next } { reason = $2; gsub(/[[:space:]]/, "", reason); path = $1; gsub(/^[[:space:]]+|[[:space:]]+$/, "", path); if (reason != "") print path }' "$allowlist"
}
