field_filled() {
  LABEL="$2:" awk '
    { line = $0; gsub(/\r/, "", line); sub(/^[-* ]+/, "", line); gsub(/\*\*/, "", line) }
    index(line, ENVIRON["LABEL"]) == 1 {
      value = substr(line, length(ENVIRON["LABEL"]) + 1)
      gsub(/^ +| +$/, "", value)
      if (value != "" && substr(value, 1, 1) != "<") ok = 1
    }
    END { exit ok ? 0 : 1 }
  ' "$1"
}

fields_report() {
  file=$1
  shift
  [ -f "$file" ] || { echo "$file is missing"; return 0; }
  for label in "$@"; do
    field_filled "$file" "$label" || echo "$file: $label is empty or still a placeholder"
  done
}

docs_or_exit() {
  docs=$(docs_dir)
  [ -d "$docs" ] || { echo "docs folder $docs not found"; exit 2; }
}
