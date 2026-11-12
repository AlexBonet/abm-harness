HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/seo-lib.sh"

seo_load || exit 2
[ -f "$SEO_DIR/robots.txt" ] || seo_finish "$SEO_DIR/robots.txt is missing"
exit 0
