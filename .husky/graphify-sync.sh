#!/usr/bin/env sh
# Background pipeline launched by .husky/post-commit:
#   1. graphify code rebuild (AST re-extract of changed files -> graph.json + GRAPH_REPORT.md)
#   2. REPO_BRAIN.html data-brain span refresh (scripts/sync-repo-brain.mjs)
# Runs detached via nohup; all output goes to ~/.cache/graphify-rebuild.log.
# Never fails the commit — errors are logged and swallowed.

# Skip during rebase/merge/cherry-pick
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
[ -d "$GIT_DIR/rebase-merge" ] && exit 0
[ -d "$GIT_DIR/rebase-apply" ] && exit 0
[ -f "$GIT_DIR/MERGE_HEAD" ] && exit 0
[ -f "$GIT_DIR/CHERRY_PICK_HEAD" ] && exit 0

CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only HEAD 2>/dev/null)
[ -z "$CHANGED" ] && exit 0

# Detect Python interpreter that has graphify installed
GRAPHIFY_PYTHON=""
GRAPHIFY_BIN=$(command -v graphify 2>/dev/null)
if [ -n "$GRAPHIFY_BIN" ]; then
    case "$GRAPHIFY_BIN" in
        *.exe) _SHEBANG="" ;;
        *)     _SHEBANG=$(head -1 "$GRAPHIFY_BIN" | sed 's/^#![[:space:]]*//') ;;
    esac
    case "$_SHEBANG" in
        */env\ *) GRAPHIFY_PYTHON="${_SHEBANG#*/env }" ;;
        *)         GRAPHIFY_PYTHON="$_SHEBANG" ;;
    esac
    case "$GRAPHIFY_PYTHON" in
        *[!a-zA-Z0-9/_.@-]*) GRAPHIFY_PYTHON="" ;;
    esac
    if [ -n "$GRAPHIFY_PYTHON" ] && ! "$GRAPHIFY_PYTHON" -c "import graphify" 2>/dev/null; then
        GRAPHIFY_PYTHON=""
    fi
fi
if [ -z "$GRAPHIFY_PYTHON" ]; then
    if command -v python3 >/dev/null 2>&1 && python3 -c "import graphify" 2>/dev/null; then
        GRAPHIFY_PYTHON="python3"
    elif command -v python >/dev/null 2>&1 && python -c "import graphify" 2>/dev/null; then
        GRAPHIFY_PYTHON="python"
    fi
fi

CODE_CHANGED=$(printf '%s\n' "$CHANGED" | grep -E '\.(js|jsx|mjs|cjs|ts|tsx|py|go|rs|java|sql)$' || true)
DOCS_CHANGED=$(printf '%s\n' "$CHANGED" | grep -E '\.(md|txt|pdf|png|jpe?g|webp|gif|mp[34]|mov|wav)$' || true)

# ── Stage 1: graphify code-only rebuild (no LLM) ─────────────────────────────
if [ -n "$CODE_CHANGED" ] && [ -n "$GRAPHIFY_PYTHON" ]; then
    export GRAPHIFY_CHANGED="$CODE_CHANGED"
    "$GRAPHIFY_PYTHON" - <<'PYEOF' || echo "[graphify hook] rebuild failed (non-blocking)"
import os, signal, sys
from pathlib import Path

changed_raw = os.environ.get('GRAPHIFY_CHANGED', '')
changed = [Path(f.strip()) for f in changed_raw.strip().splitlines() if f.strip()]
if not changed:
    sys.exit(0)
print(f'[graphify hook] {len(changed)} file(s) changed - rebuilding graph...')
try:
    from graphify.watch import _rebuild_code, _apply_resource_limits
    _apply_resource_limits()
    _timeout = int(os.environ.get('GRAPHIFY_REBUILD_TIMEOUT', '600'))
    if _timeout > 0 and hasattr(signal, 'SIGALRM'):
        signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError(f'graphify rebuild exceeded {_timeout}s')))
        signal.alarm(_timeout)
    _force = os.environ.get('GRAPHIFY_FORCE', '').lower() in ('1', 'true', 'yes')
    _rebuild_code(Path('.'), changed_paths=changed, force=_force)
except TimeoutError as exc:
    print(f'[graphify hook] {exc}')
    sys.exit(1)
except Exception as exc:
    print(f'[graphify hook] Rebuild failed: {exc}')
    sys.exit(1)
PYEOF
fi

if [ -n "$DOCS_CHANGED" ]; then
    echo "[graphify hook] doc/image files changed - run /graphify --update for semantic re-extraction"
fi

# ── Stage 2: REPO_BRAIN.html span refresh (always, sub-second) ───────────────
if command -v node >/dev/null 2>&1 && [ -f scripts/sync-repo-brain.mjs ]; then
    node scripts/sync-repo-brain.mjs || echo "[repo-brain] sync failed (non-blocking)"
else
    echo "[repo-brain] node or scripts/sync-repo-brain.mjs not found - skipping"
fi

exit 0
