```
#!/bin/bash
# HARNESS: Pre-flight check
# Runs before the Coder starts any work. Validates environment, artifacts, and dependencies.
# If this script exits non-zero, the agent MUST halt and ask for help.
set -e

# ============================================================
# PROJECT-SPECIFIC CONFIG — set these before deploying
# ============================================================
STACK_NAME="{STACK_NAME}"            # web | android | shared
DEPENDENCIES=({DEPENDENCY_LIST})     # e.g. "astro" "react" "firebase" "@supabase"
TOOL="{BUILD_TOOL}"                  # pnpm | npm | gradle
SRC_PATHS=({SRC_PATH_LIST})          # e.g. "src/" "app/src/main/java/"
SHARED_REL="../00-docs"              # path to the docs folder relative to repo root
# ============================================================

PASS=0
FAIL=0

section() { echo ""; echo "=== $1 ==="; }
ok() { echo "  ✅ $1"; ((PASS++)); }
fail() { echo "  ❌ $1"; ((FAIL++)); }
warn() { echo "  ⚠️  $1"; }

echo "[HARNESS] Running pre-flight checks for $STACK_NAME..."

# ───────────────────────────────────────────
# 1. Git state
# ───────────────────────────────────────────
section "Git state"
if [[ -n $(git status -s) ]]; then
  fail "Working directory is not clean. Commit or stash changes before starting."
  echo "  Uncommitted files:"
  git status -s | head -10
else
  ok "Working directory clean"
fi

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
ok "Current branch: $BRANCH"

# ───────────────────────────────────────────
# 2. Required artifacts (00-docs/)
# ───────────────────────────────────────────
section "Required artifacts"

if [[ -f "$SHARED_REL/PROJECT_CONTEXT.md" ]]; then
  ok "PROJECT_CONTEXT.md found"
else
  fail "PROJECT_CONTEXT.md not found in $SHARED_REL/"
fi

if [[ -f "$SHARED_REL/AGENT.md" ]]; then
  ok "AGENT.md found"
else
  fail "AGENT.md not found in $SHARED_REL/"
fi

if [[ -f "$SHARED_REL/MEMORY.md" ]]; then
  ok "MEMORY.md found"
else
  warn "MEMORY.md not found. Fresh session — no prior context to recover."
fi

if [[ -f "$SHARED_REL/AGENT_CODER.md" ]]; then
  ok "AGENT_CODER.md found"
else
  fail "AGENT_CODER.md not found in $SHARED_REL/"
fi

if [[ -f "$SHARED_REL/database/SCHEMA.md" ]]; then
  ok "SCHEMA.md found"
else
  warn "SCHEMA.md not found. Database context is missing."
fi

# ───────────────────────────────────────────
# 3. Project calibration
# ───────────────────────────────────────────
section "Project calibration"
echo "  Detected stack: $STACK_NAME"

case "$TOOL" in
  pnpm|npm)
    if [[ -f "package.json" ]]; then
      ok "package.json found"
      LOCKFILE=""
      [[ "$TOOL" == "pnpm" ]] && LOCKFILE="pnpm-lock.yaml"
      [[ "$TOOL" == "npm" ]] && LOCKFILE="package-lock.json"
      if [[ -f "$LOCKFILE" ]]; then
        ok "$LOCKFILE found ($TOOL is package manager)"
      else
        fail "$LOCKFILE not found. Run $TOOL install before starting."
      fi
      if [[ -d "node_modules" ]]; then
        ok "node_modules installed"
      else
        fail "node_modules not found. Run $TOOL install before starting."
      fi
    else
      fail "package.json not found. Is this the right directory?"
    fi

    # Check key dependencies exist
    for dep in "${DEPENDENCIES[@]}"; do
      if grep -q "\"$dep\"" package.json 2>/dev/null; then
        ok "$dep dependency present"
      else
        fail "$dep dependency missing from package.json"
      fi
    done
    ;;
  gradle)
    if [[ -f "gradlew" ]] || [[ -f "build.gradle.kts" ]]; then
      ok "Gradle wrapper found"
      # Check for key dependencies
      for dep in "${DEPENDENCIES[@]}"; do
        if grep -qi "$dep" build.gradle.kts build.gradle 2>/dev/null; then
          ok "$dep dependency present"
        else
          warn "$dep dependency not found — may be in a module subproject"
        fi
      done
    else
      fail "Gradle wrapper not found. Build commands will fail."
    fi
    ;;
esac

# ───────────────────────────────────────────
# 4. Test runner availability
# ───────────────────────────────────────────
section "Test runner"

case "$TOOL" in
  pnpm|npm)
    if grep -q '"test"' package.json 2>/dev/null; then
      ok "Test command found in package.json"
      TEST_COUNT=0
      for sp in "${SRC_PATHS[@]}"; do
        COUNT=$(find "$sp" -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
        TEST_COUNT=$((TEST_COUNT + COUNT))
      done
      if [[ "$TEST_COUNT" -gt 0 ]]; then
        ok "Test files found: $TEST_COUNT"
      else
        warn "No test files found. Tests are configured but have 0 tests."
      fi
    else
      fail "No 'test' script in package.json"
    fi
    ;;
  gradle)
    ok "Test command: ./gradlew test"
    ;;
esac

# ───────────────────────────────────────────
# 5. Linter availability
# ───────────────────────────────────────────
section "Linter"

case "$TOOL" in
  pnpm|npm)
    if grep -q '"lint"' package.json 2>/dev/null; then
      ok "Lint command found in package.json"
    else
      warn "No 'lint' script in package.json"
    fi
    if ls eslint.config.* 1>/dev/null 2>&1; then
      ok "ESLint config found"
    else
      warn "ESLint config not found"
    fi
    ;;
  gradle)
    if grep -q "detekt" build.gradle.kts build.gradle 2>/dev/null; then
      ok "Detekt configured"
    else
      warn "Detekt not found in Gradle config"
    fi
    ;;
esac

# ───────────────────────────────────────────
# 6. Clean Architecture structure check
# ───────────────────────────────────────────
section "Clean Architecture structure"

for sp in "${SRC_PATHS[@]}"; do
  if [[ -d "${sp}domain" ]]; then
    ok "${sp}domain/ exists"
  else
    warn "${sp}domain/ not found. Domain layer may not be structured yet."
  fi
  if [[ -d "${sp}data" ]]; then
    ok "${sp}data/ exists"
  else
    warn "${sp}data/ not found. Data layer may not be structured yet."
  fi
  if [[ -d "${sp}presentation" ]]; then
    ok "${sp}presentation/ exists"
  else
    warn "${sp}presentation/ not found. Presentation layer may not be structured yet."
  fi
done

# ───────────────────────────────────────────
# 7. OpenCode config
# ───────────────────────────────────────────
section "OpenCode config"

if [[ -f "opencode.json" ]]; then
  ok "opencode.json found in workspace"
else
  fail "opencode.json not found in workspace. Agent may lack MCP configuration."
fi

# ───────────────────────────────────────────
# Summary
# ───────────────────────────────────────────
echo ""
echo "=============================="
echo "  PRE-FLIGHT RESULTS"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "=============================="

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "[HARNESS] HALTED. Fix the failures above before starting work."
  exit 1
fi

echo ""
echo "[HARNESS] Pre-flight passed. Environment ready."
exit 0
```
