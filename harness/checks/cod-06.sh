HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib.sh"

check_duplicates() {
  found=$(src_files | grep -vE "$TEST_RE" | while IFS= read -r file; do
    sed -En "$SIG_SED" "$file" | grep -vE "$SIG_EXEMPT_RE" | sort -u | while IFS= read -r signature; do
      printf '%s\t%s\n' "$signature" "$file"
    done
  done | awk -F'\t' '{ files[$1] = files[$1] " " $2; count[$1]++ } END { for (s in count) if (count[s] > 1) print s " duplicated in" files[s] }' | sort)
  [ -z "$found" ] && return 0
  echo "$found"
  return 1
}

each_stack check_duplicates
exit $?
