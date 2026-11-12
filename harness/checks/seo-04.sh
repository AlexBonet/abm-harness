HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/seo-lib.sh"

seo_load || exit 2
for map in "$SEO_DIR/sitemap.xml" "$SEO_DIR/sitemap-index.xml"; do
  [ -f "$map" ] || continue
  grep -qi '<loc>' "$map" && exit 0
  seo_finish "$map has no <loc> entry"
done
seo_finish "$SEO_DIR/sitemap.xml is missing"
