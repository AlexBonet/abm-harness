ABMH_DIR=$(cd "$HERE/.." && pwd)
PROJECT=$(cd "$ABMH_DIR/.." && pwd)
REL=$(basename "$ABMH_DIR")
EMPTY_TREE=4b825dc642cb6eb9a060e54bf8d69288fbee4904

in_git() {
  git -C "$PROJECT" rev-parse --is-inside-work-tree > /dev/null 2>&1
}

cfg() {
  [ -f "$ABMH_DIR/harness.yaml" ] && sed -n "s/^$1: *//p" "$ABMH_DIR/harness.yaml" | head -n 1 | tr -d '\r' | sed -e 's/[[:space:]]*#.*$//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

base() {
  git -C "$PROJECT" rev-parse -q --verify HEAD 2> /dev/null || echo "$EMPTY_TREE"
}

untracked() {
  git -C "$PROJECT" -c core.quotePath=false ls-files --others --exclude-standard -- . | grep -v '/$'
}

has_changes() {
  [ -n "$(git -C "$PROJECT" status --porcelain -- . 2> /dev/null)" ]
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
