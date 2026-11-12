HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

docs=$(docs_dir)
for file in DESIGN.md design-tokens.md "$docs/DESIGN.md" "$docs/design-tokens.md"; do
  [ -f "$file" ] && exit 0
done
echo "no DESIGN.md or design-tokens.md at the root or in $docs"
exit 1
