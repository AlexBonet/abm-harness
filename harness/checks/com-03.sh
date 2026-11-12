HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

docs=$(docs_dir)
[ -d "$docs" ] || { echo "docs folder $docs not found"; exit 2; }
[ -f "$docs/GLOSSARY.md" ] && exit 0
echo "$docs/GLOSSARY.md is missing"
exit 1
