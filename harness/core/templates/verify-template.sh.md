```
#!/bin/bash
# HARNESS: Clean Architecture & Quality Gates
# Runs after the Coder finishes work. Must exit with 0 for the task to be marked DONE.
# If this script exits non-zero, the Coder MUST fix violations and re-run.
set -e

# ============================================================
# PROJECT-SPECIFIC CONFIG — set these before deploying
# ============================================================
FORBIDDEN_PATTERNS=({PATTERN_LIST})   # e.g. "from ['\"]react" "from ['\"]firebase" "from ['\"]astro"
DOMAIN_PATH="{DOMAIN_PATH}"            # e.g. "src/domain" or "app/src/main/java/.../domain"
BUILD_TOOL="{BUILD_TOOL}"              # pnpm | npm | gradle
LINT_CMD="{LINT_CMD}"                  # "pnpm run lint" | "./gradlew detekt" | "npm run lint"
TEST_CMD="{TEST_CMD}"                  # "pnpm run test" | "./gradlew test" | "npm test"
MAX_LINES=300
# ============================================================

PASS=0
FAIL=0

section() { echo ""; echo "=== $1 ==="; }
ok() { echo "  ✅ $1"; ((PASS++)); }
fail() { echo "  ❌ $1"; ((FAIL++)); }
warn() { echo "  ⚠️  $1"; }

echo "[HARNESS] Running verification..."

# ═══════════════════════════════════════════
# GATE 1: Clean Architecture Boundary Check
# ═══════════════════════════════════════════
section "Clean Architecture boundaries"

if [[ -n "$DOMAIN_PATH" && -d "$DOMAIN_PATH" ]]; then
  ok "Domain directory found: $DOMAIN_PATH"

  VIOLATIONS=0
  for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    MATCH=$(grep -rnE "$pattern" "$DOMAIN_PATH" --include="*.ts" --include="*.tsx" --include="*.kt" --include="*.java" 2>/dev/null || true)
    if [[ -n "$MATCH" ]]; then
      fail "Domain purity violation — $pattern"
      echo "$MATCH" | head -5
      ((VIOLATIONS++))
    fi
  done

  if [[ $VIOLATIONS -eq 0 ]]; then
    ok "No forbidden imports in domain files"
  fi
else
  warn "Domain directory not found at $DOMAIN_PATH. Skipping boundary check."
fi

# ═══════════════════════════════════════════
# GATE 2: File Length Check
# ═══════════════════════════════════════════
section "File length (max $MAX_LINES lines)"

LONG_FILES=0

while IFS= read -r -d '' file; do
  LINES=$(wc -l < "$file")
  if [[ $LINES -gt $MAX_LINES ]]; then
    fail "$file has $LINES lines (max: $MAX_LINES)"
    ((LONG_FILES++))
  fi
done < <(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.astro" -o -name "*.kt" -o -name "*.java" \) -not -path "*/node_modules/*" -not -path "*/.astro/*" -not -path "*/dist/*" -not -path "*/.gradle/*" -not -path "*/build/*" -print0 2>/dev/null)

if [[ $LONG_FILES -eq 0 ]]; then
  ok "All source files under $MAX_LINES lines"
fi

# ═══════════════════════════════════════════
# GATE 3: No `any` type (TypeScript)
# ═══════════════════════════════════════════
section "Type safety (no \`any\`)"

ANY_VIOLATIONS=0
while IFS= read -r -d '' file; do
  ANY_LINES=$(grep -nE "\bany\b" "$file" 2>/dev/null | grep -v "//" | grep -v "/\*" | grep -v "^\s*\*" | head -5 || true)
  if [[ -n "$ANY_LINES" ]]; then
    fail "TypeScript \`any\` found in $file:"
    echo "$ANY_LINES"
    ((ANY_VIOLATIONS++))
  fi
done < <(find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.astro/*" -not -path "*/dist/*" -not -name "*.d.ts" -print0 2>/dev/null)

if [[ $ANY_VIOLATIONS -eq 0 ]]; then
  ok "No TypeScript \`any\` type violations found"
fi

# ═══════════════════════════════════════════
# GATE 4: Hardcoded UI strings (basic check)
# ═══════════════════════════════════════════
section "i18n compliance (basic check)"

HARDCODE_COUNT=0

while IFS= read -r -d '' file; do
  HARDCODED=$(grep -nE '>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+([ ][A-ZÁÉÍÓÚÑa-záéíóúñ]+)+<' "$file" 2>/dev/null | grep -v "className\|style\|key\|id=" | head -5 || true)
  if [[ -n "$HARDCODED" ]]; then
    fail "Possible hardcoded UI string in $file:"
    echo "$HARDCODED"
    ((HARDCODE_COUNT++))
  fi
done < <(find . -type f -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/dist/*" -print0 2>/dev/null)

if [[ $HARDCODE_COUNT -eq 0 ]]; then
  ok "No obvious hardcoded strings in TSX components"
fi

# ═══════════════════════════════════════════
# GATE 5: Linter
# ═══════════════════════════════════════════
section "Linter"

if [[ -n "$LINT_CMD" ]]; then
  echo "  Running $LINT_CMD..."
  if eval "$LINT_CMD" 2>&1; then
    ok "Linter passed"
  else
    fail "Linter found issues"
  fi
else
  warn "No lint command configured — skipping"
fi

# ═══════════════════════════════════════════
# GATE 6: Unit Tests
# ═══════════════════════════════════════════
section "Unit tests"

if [[ -n "$TEST_CMD" ]]; then
  echo "  Running $TEST_CMD..."
  if eval "$TEST_CMD" 2>&1; then
    ok "All tests passed"
  else
    fail "Tests failed"
  fi
else
  warn "No test command configured — skipping"
fi

# ═══════════════════════════════════════════
# GATE 7: Rule packs
# ═══════════════════════════════════════════
section "Rule packs"

if [[ -f ".abmh/checks/check.sh" ]]; then
  if sh .abmh/checks/check.sh prueba; then
    ok "Rule packs passed (NOT RUN items are listed above)"
  else
    fail "A rule pack check failed"
  fi
else
  warn "Rule packs are not installed — skipping"
fi

# ═══════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════
echo ""
echo "=============================="
echo "  VERIFICATION RESULTS"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "=============================="

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "[HARNESS] REJECTED. Fix the violations above and re-run verify.sh."
  echo "  The task CANNOT be marked as DONE until all gates pass."
  exit 1
fi

echo ""
echo "[HARNESS] Verification passed. Task can be marked as DONE."
exit 0
```
