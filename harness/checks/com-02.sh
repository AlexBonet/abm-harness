HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

memory="$(docs_dir)/MEMORY.md"
[ -f "$memory" ] || { echo "$memory not found"; exit 2; }
size=$(wc -c < "$memory" | tr -d ' ')
found=""
[ "$size" -le 8192 ] || found="$memory: $size bytes, the cap is 8192\n"
long=$(LC_ALL=C awk -v file="$memory" '/^- / && length($0) > 600 { print file ":" NR " entry over 600 bytes" }' "$memory")
[ -z "$found" ] && [ -z "$long" ] && exit 0
printf '%b' "$found"
[ -z "$long" ] || echo "$long"
exit 1
