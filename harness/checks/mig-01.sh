HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"
. "$HERE/mig-lib.sh"

mig_load_matching || exit 2
found=$(mig_new | while IFS= read -r name; do
  header=$(mig_header "$MIG_DIR/$name")
  spec=$(mig_field "$header" spec)
  echo "$spec" | grep -qE '^SPEC-[A-Za-z0-9-]*[0-9]+$' || echo "$name: missing or invalid field spec: (a SPEC id)"
  [ "$(mig_field "$header" local-test)" = yes ] || echo "$name: missing or invalid field local-test: (yes)"
  [ -n "$(mig_field "$header" backup)" ] || echo "$name: missing or invalid field backup: (text)"
  [ -n "$(mig_field "$header" rollback)" ] || echo "$name: missing or invalid field rollback: (text)"
done)
[ -z "$found" ] && exit 0
echo "$found"
exit 1
