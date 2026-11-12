HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/seo-lib.sh"

valid_json() {
  [ -n "$(printf '%s' "$1" | tr -d '[:space:]')" ] || return 1
  if command -v node > /dev/null 2>&1; then
    printf '%s\n' "$1" | node -e 'JSON.parse(require("fs").readFileSync(0, "utf8"))' > /dev/null 2>&1
  else
    printf '%s\n' "$1" | jq empty > /dev/null 2>&1
  fi
}

ld_blocks() {
  printf '%s\n' "$1" | sed -E 's/<\/[sS][cC][rR][iI][pP][tT]>/\
/g' | grep -iE '<script[^>]*ld[+]json' | sed -E 's/^.*<[sS][cC][rR][iI][pP][tT][^>]*>//'
}

seo_load || exit 2
command -v node > /dev/null 2>&1 || command -v jq > /dev/null 2>&1 || { echo "SEO-07 needs node or jq to parse JSON-LD"; exit 2; }
total=0
found=$(printf '%s\n' "$SEO_PAGES" | while IFS= read -r page; do
  ld_blocks "$(page_text "$page")" | while IFS= read -r block; do
    valid_json "$block" || { printf '%s\n' "$page: JSON-LD does not parse"; break; }
  done
done)
[ -n "$found" ] && seo_finish "$found"
any=$(printf '%s\n' "$SEO_PAGES" | while IFS= read -r page; do ld_blocks "$(page_text "$page")"; done)
[ -n "$any" ] || { echo "no JSON-LD block in any page, nothing to check"; exit 2; }
exit 0
