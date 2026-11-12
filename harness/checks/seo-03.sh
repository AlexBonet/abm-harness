HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/seo-lib.sh"

has_canonical() {
  printf '%s\n' "$1" | grep -oiE '<link[^>]*>' | grep -iE "rel=[\"']?canonical[\"']?([[:space:]/>]|$)" | grep -qiE "href=[\"'][^\"']+[\"']|href=[^\"'[:space:]>]+"
}

seo_run has_canonical "missing canonical link"
