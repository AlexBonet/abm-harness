mig_dir() {
  dir=$(cfg migrations_dir)
  if [ -z "$dir" ]; then
    for candidate in supabase/migrations migrations db/migrations; do
      if [ -d "$candidate" ] && find "$candidate" -maxdepth 1 -name '*.sql' | grep -q .; then
        dir=$candidate
        break
      fi
    done
  fi
  dir=$(echo "$dir" | sed 's|//*|/|g; s|^\./||; s|/$||')
  if [ -z "$dir" ] || [ ! -d "$dir" ]; then
    echo "no migrations folder (set migrations_dir in harness.yaml)"
    return 2
  fi
  MIG_DIR=$dir
}

mig_scan() {
  find "$MIG_DIR" -maxdepth 1 -type f -name '*.sql' | sed 's|.*/||' | sort | awk -v pattern="$MIG_PATTERN" -v from="$MIG_FROM" '
    function literal(text,    out, i, c) {
      out = ""
      for (i = 1; i <= length(text); i++) {
        c = substr(text, i, 1)
        out = out (c == "." ? "[.]" : c)
      }
      return out
    }
    BEGIN {
      if (pattern !~ /^[A-Za-z0-9_.-]*N+[A-Za-z0-9_.-]*$/ || !match(pattern, /N+/)) { print "INVALID"; exit }
      width = RLENGTH
      plen = RSTART - 1
      suffix = literal(substr(pattern, RSTART + RLENGTH))
      sub(/name/, "[A-Za-z0-9_.-]+", suffix)
      digits = ""
      for (i = 0; i < width; i++) digits = digits "[0-9]"
      regex = "^" literal(substr(pattern, 1, plen)) digits suffix "$"
    }
    $0 ~ regex { number = substr($0, plen + 1, width) + 0; print (number >= from ? "NEW" : "OLD") "\t" number "\t" $0; next }
    match($0, /[0-9]+/) && substr($0, RSTART, RLENGTH) + 0 < from { print "OLD\t0\t" $0; next }
    { print "BAD\t0\t" $0 }
  '
}

mig_load() {
  mig_dir || return 2
  MIG_PATTERN=$(cfg_or migration_pattern NNN_name.sql)
  MIG_FROM=$(cfg_or migrations_from 1)
  case $MIG_FROM in
    (*[!0-9]*) echo "migrations_from must be a number"; return 2 ;;
  esac
  MIG_ROWS=$(mig_scan)
  case $MIG_ROWS in
    (INVALID*) echo "migration_pattern $MIG_PATTERN needs a run of N for the number, for example NNN_name.sql"; return 2 ;;
  esac
}

mig_load_matching() {
  mig_load || return 2
  echo "$MIG_ROWS" | grep -qE '^(NEW|OLD)' && return 0
  echo "$MIG_ROWS" | grep -q . || return 0
  echo "no migration file matches the pattern $MIG_PATTERN (set migration_pattern in harness.yaml)"
  return 2
}

mig_new() {
  echo "$MIG_ROWS" | awk -F'\t' '$1 == "NEW" { print $3 }'
}

mig_header() {
  tr -d '\r' < "$1" | sed "1s/^$(printf '\357\273\277')//" | awk '/^--/ { print; next } /^[[:space:]]*$/ { next } { exit }'
}

mig_field() {
  echo "$1" | sed -n "s/^-- *$2: *//p" | head -n 1
}
