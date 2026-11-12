HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

docs=$(docs_dir)
[ -d "$docs" ] || { echo "docs folder $docs not found"; exit 2; }
found=$(find "$docs" -name archive -prune -o -type f -name '*.md' -print | sort | while IFS= read -r file; do
  top=$(head -n 8 "$file")
  echo "$top" | grep -qE '^Audience: (person|agent|both)$' || echo "$file: missing the Audience line in the first 8 lines"
  echo "$top" | grep -qE '^> \*\*(Summary|Resumen|En corto):\*\*' || echo "$file: missing the summary quote in the first 8 lines"
done)
[ -z "$found" ] && exit 0
echo "$found"
exit 1
