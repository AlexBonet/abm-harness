ABMH_DIR=$(cd "$HERE/.." && pwd)
PROJECT=$(git rev-parse --show-toplevel 2> /dev/null) || PROJECT=""
[ -n "$PROJECT" ] || PROJECT=$(cd "$ABMH_DIR/.." && pwd)
EMPTY_TREE=4b825dc642cb6eb9a060e54bf8d69288fbee4904

in_git() {
  git -C "$PROJECT" rev-parse --is-inside-work-tree > /dev/null 2>&1
}

yaml_value() {
  [ -f "$2" ] && sed -n "s/^$1: *//p" "$2" | head -n 1 | tr -d '\r' | sed -e 's/[[:space:]]*#.*$//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

cfg() {
  value=$(yaml_value "$1" "$ABMH_DIR/harness.yaml")
  [ -n "$value" ] || value=$(yaml_value "$1" "$HERE/defaults.yaml")
  printf '%s\n' "$value"
}

JSON_UNESCAPE='
function hex(h,  i, n) { n = 0; for (i = 1; i <= 4; i++) n = n * 16 + index("0123456789abcdef", tolower(substr(h, i, 1))) - 1; return n }
function utf8(n) {
  if (n < 128) return sprintf("%c", n)
  if (n < 2048) return sprintf("%c%c", 192 + int(n / 64), 128 + n % 64)
  if (n < 65536) return sprintf("%c%c%c", 224 + int(n / 4096), 128 + int(n / 64) % 64, 128 + n % 64)
  return sprintf("%c%c%c%c", 240 + int(n / 262144), 128 + int(n / 4096) % 64, 128 + int(n / 64) % 64, 128 + n % 64)
}
{
  out = ""
  for (i = 1; i <= length($0); i++) {
    c = substr($0, i, 1)
    if (c != "\\") { out = out c; continue }
    c = substr($0, ++i, 1)
    if (c == "u") {
      n = hex(substr($0, i + 1, 4)); i += 4
      if (n >= 55296 && n < 56320 && substr($0, i + 1, 2) == "\\u") { n = 65536 + (n - 55296) * 1024 + hex(substr($0, i + 3, 4)) - 56320; i += 6 }
      out = out utf8(n)
    } else if (c == "n") out = out "\n"
    else if (c == "t") out = out "\t"
    else if (c == "r") out = out "\r"
    else if (c == "b") out = out "\b"
    else if (c == "f") out = out "\f"
    else out = out c
  }
  print out
}'

json_field() {
  printf '%s' "$1" | grep -oE "\"$2\" *: *\"([^\"\\\\]|\\\\.)*\"" | head -n 1 | sed -e 's/^"[^"]*" *: *"//' -e 's/"$//' | LC_ALL=C awk "$JSON_UNESCAPE"
}

session_of() {
  json_field "$1" session_id | tr -cd 'A-Za-z0-9_-'
}

base() {
  [ -n "${REVIEW_BASE:-}" ] && { echo "$REVIEW_BASE"; return; }
  git -C "$PROJECT" rev-parse -q --verify HEAD 2> /dev/null || echo "$EMPTY_TREE"
}

untracked() {
  git -C "$PROJECT" ls-files -z --others --exclude-standard -- . | tr '\0' '\n' | grep -v '/$'
}

has_changes() {
  [ -n "$(git -C "$PROJECT" status --porcelain -- . 2> /dev/null)" ] && return 0
  [ -n "${REVIEW_BASE:-}" ] && ! git -C "$PROJECT" diff --quiet "$REVIEW_BASE" -- .
}

fingerprint() {
  {
    git -C "$PROJECT" diff "$(base)" --binary -- .
    untracked | while IFS= read -r file; do
      printf '%s %s\n' "$file" "$(git -C "$PROJECT" hash-object -- "$file")"
    done
  } | shasum -a 256 | cut -c1-12
}

changed_lines() {
  tracked=$(git -C "$PROJECT" diff "$(base)" --numstat -- . | awk '$1 != "-" { sum += $1 + $2 } END { print sum + 0 }')
  fresh=$(untracked | while IFS= read -r file; do wc -l < "$PROJECT/$file"; done | awk '{ sum += $1 } END { print sum + 0 }')
  echo $((tracked + fresh))
}

state_dir() {
  dir=$(git -C "$PROJECT" rev-parse --git-path abmh-reviews)
  case $dir in
    /*) ;;
    *) dir="$PROJECT/$dir" ;;
  esac
  mkdir -p "$dir"
  echo "$dir"
}

changed_files() {
  { git -C "$PROJECT" diff -z --name-only "$(base)" -- . | tr '\0' '\n'; untracked; } | sort -u
}

hashed() {
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if [ -f "$PROJECT/$file" ]; then
      printf '%s %s\n' "$file" "$(git -C "$PROJECT" hash-object -- "$file")"
    else
      printf '%s deleted\n' "$file"
    fi
  done
}

code_only() {
  patterns=$(cfg review_docs)
  set -f
  while IFS= read -r file; do
    keep=1
    for pattern in $patterns; do
      case $file in $pattern) keep=0; break ;; esac
    done
    [ "$keep" -eq 1 ] && printf '%s\n' "$file"
  done
  set +f
}

counted() {
  changed=$(changed_files)
  code_only | sort -u | while IFS= read -r file; do
    printf '%s\n' "$changed" | grep -Fxq -- "$file" && printf '%s\n' "$file"
  done | hashed
}
