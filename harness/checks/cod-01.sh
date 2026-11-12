HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

check_boundaries() {
  configured=$(cfg_or domain_dir "" | sed 's|^\./||; s|/*$||')
  if [ -n "$configured" ]; then
    folders=$configured
  else
    folders=$(find . \( -name node_modules -o -name .git -o -name build -o -name dist -o -name .abmh \) -prune -o -type d -name "$DOMAIN_NAME" -print | sed 's|^\./||')
  fi
  [ -n "$folders" ] || { echo "no $DOMAIN_NAME folder found; set domain_dir in harness.yaml"; return 2; }
  found=$(src_files | while IFS= read -r file; do
    echo "$folders" | while IFS= read -r folder; do
      case "$file" in
        ("$folder"/*) grep -nE "$DOMAIN_FORBIDDEN_RE" "$file" | cut -d: -f1 | while read -r line; do echo "$file:$line framework, database or UI import inside the domain"; done ;;
      esac
    done
  done)
  [ -z "$found" ] && return 0
  echo "$found"
  return 1
}

each_stack check_boundaries
exit $?
