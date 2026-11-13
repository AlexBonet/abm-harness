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
  { { cat "$MIG_BASELINE_FILE"; echo; } | sed -e 's/\r$//' -e '/^[[:space:]]*\(#\|$\)/d' -e 's/^/B\t/'; find "$MIG_DIR" -maxdepth 1 -type f -name '*.sql' | sed 's|.*/||' | sort | sed 's/^/F\t/'; } | awk -F'\t'  -v pattern="$MIG_PATTERN" -v from="$MIG_FROM" -v prefixes="$MIG_PREFIXES" -v companions="$MIG_COMPANIONS" -v has_baseline="$MIG_HAS_BASELINE" '
    function literal(text) { gsub(/[.]/, "[.]", text); return text }
    function starts(text, head) { return head != "" && substr(text, 1, length(head)) == head }
    function split_family(text,    i) {
      family = "-"; body = text
      for (i = 1; i <= families; i++) if (starts(text, family_list[i])) { family = family_list[i]; body = substr(text, length(family) + 1); return }
    }
    function split_companion(text,    i) {
      for (i = 1; i <= kinds; i++) if (starts(text, companion_list[i])) { family = "-"; body = substr(text, length(companion_list[i]) + 1); return }
      split_family(text) }
    $1 == "B" { listed[$2] = 1; split_companion($2); if (body ~ regex) print "BASE\t" (substr(body, plen + 1, width) + 0) "\t" $2 "\t" family; next }
    BEGIN {
      if (pattern !~ /^[A-Za-z0-9_.-]*N+[A-Za-z0-9_.-]*$/ || !match(pattern, /N+/)) { print "INVALID"; exit }
      width = RLENGTH
      plen = RSTART - 1
      tail = substr(pattern, RSTART + RLENGTH)
      at = index(tail, "name")
      before_name = at ? substr(tail, 1, at - 1) : tail; after_name = at ? substr(tail, at + 4) : ""
      suffix = literal(tail)
      sub(/name/, "[A-Za-z0-9_.-]+", suffix)
      digits = ""
      for (i = 0; i < width; i++) digits = digits "[0-9]"
      regex = "^" literal(substr(pattern, 1, plen)) digits suffix "$"
      families = split(prefixes, family_list, /[ ,]+/)
      kinds = split(companions, companion_list, /[ ,]+/)
    }
    {
      name = $2
      state = name in listed ? "OLD" : "NEW"
      for (i = 1; i <= kinds; i++) if (starts(name, companion_list[i])) { old = state == "OLD"; state = "COMP"; companion = companion_list[i]; break }
      family = "-"
      body = name
      if (state == "COMP") {
        body = substr(name, length(companion) + 1)
        if (body ~ regex) print "COMP\t" (substr(body, plen + 1, width) + 0) "\t" name "\t-"
        else print (old || (has_baseline != "yes" && match(name, /[0-9]+/) && substr(name, RSTART, RLENGTH) + 0 < from) ? "OLDCOMP" : "BAD") "\t0\t" name "\t-"
        next
      }
      split_family(name)
      if (body ~ regex) {
        raw = substr(body, plen + 1, width)
        number = raw + 0
        rest = substr(body, plen + width + 1)
        stem = substr(rest, length(before_name) + 1, length(rest) - length(before_name) - length(after_name))
        if (state == "NEW" && has_baseline != "yes" && number < from) state = "OLD"
        print state "\t" number "\t" name "\t" family "\t" raw "\t" stem
        next
      }
      if (state == "OLD") { print "OLD\t0\t" name "\t" family; next }
      if (has_baseline != "yes" && match(name, /[0-9]+/) && substr(name, RSTART, RLENGTH) + 0 < from) { print "OLD\t0\t" name "\t-"; next }
      print "BAD\t0\t" name "\t-"
    }
  '
}

mig_load() {
  mig_dir || return 2
  MIG_PATTERN=$(cfg_or migration_pattern NNN_name.sql)
  MIG_FROM=$(cfg_or migrations_from 1)
  case $MIG_FROM in
    (*[!0-9]*) echo "migrations_from must be a number"; return 2 ;;
  esac
  MIG_PREFIXES=$(cfg migration_prefixes)
  MIG_COMPANIONS=$(cfg migration_companions)
  MIG_BASELINE_FILE=/dev/null
  MIG_HAS_BASELINE=no
  baseline=$(cfg migrations_baseline)
  if [ -n "$baseline" ]; then
    [ -f "$baseline" ] || { echo "migrations_baseline $baseline is not a file"; return 2; }
    MIG_BASELINE_FILE=$baseline
    MIG_HAS_BASELINE=yes
  fi
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
