HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/seo-lib.sh"

has_title() {
  page_head "$1" | grep -qiE '<title[^>]*>[^<]*[^[:space:]<][^<]*</title>'
}

seo_run has_title "missing or empty <title>"
