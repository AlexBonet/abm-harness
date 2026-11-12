HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/seo-lib.sh"

has_description() {
  printf '%s\n' "$1" | grep -oiE '<meta[^>]*>' | grep -iE "name=[\"']?description[\"']?([[:space:]/>]|$)" | grep -qiE "content=[\"'][^\"']*[^[:space:]\"'][^\"']*[\"']|content=[^\"'[:space:]>]+"
}

seo_run has_description "missing or empty meta description"
