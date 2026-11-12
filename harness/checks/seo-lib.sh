page_text() {
  tr -d '\r' < "$1" | tr '\n\t' '  '
}

page_head() {
  head_part=$(printf '%s\n' "$1" | grep -oiE '<head[ >].*</head>')
  printf '%s\n' "${head_part:-$1}"
}

seo_load() {
  SEO_DIR=$(cfg html_dir)
  [ -n "$SEO_DIR" ] || { echo "no html_dir: in harness.yaml (the folder with the built HTML)"; return 2; }
  [ -d "$SEO_DIR" ] || { echo "html_dir $SEO_DIR not found, build the site first"; return 2; }
  SEO_PAGES=$(find "$SEO_DIR" -type f -name '*.html' ! -name 404.html | sort | while IFS= read -r page; do
    page_text "$page" | grep -oiE '<meta[^>]*>' | grep -iE "name=[\"']?robots" | grep -qi noindex || printf '%s\n' "$page"
  done)
  [ -n "$SEO_PAGES" ] || { echo "no HTML pages in $SEO_DIR"; return 2; }
}

seo_finish() {
  [ -z "$1" ] && exit 0
  printf '%s\n' "$1"
  exit 1
}

seo_run() {
  seo_load || exit 2
  found=$(printf '%s\n' "$SEO_PAGES" | while IFS= read -r page; do
    "$1" "$(page_text "$page")" || printf '%s\n' "$page: $2"
  done)
  seo_finish "$found"
}
