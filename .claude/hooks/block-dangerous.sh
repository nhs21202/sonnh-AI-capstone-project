#!/bin/bash
# PreToolUse hook — blocks dangerous Bash commands before Claude Code runs them.
# Exit-code contract: 2 = BLOCK. 0 = allow.
#   WARNING: exit 1 does NOT block — it is only a warning, the action STILL runs.

INPUT=$(cat)   # read the JSON event from stdin (never from env vars)

# --- Parser selection (probe-validated) -------------------------------------
# We can't just check `command -v`: on Windows, `python3` is often a fake
# App-Execution-Alias stub that exists on PATH but produces no output. So we
# PROBE each candidate against a known JSON and only trust one that round-trips
# the sentinel value. This also disambiguates "no command field" from
# "parser broken" so the fail-closed branch is reliable.
PROBE='{"tool_input":{"command":"__probe__"}}'
PY_EXTRACT="import sys,json;print(json.load(sys.stdin).get('tool_input',{}).get('command',''))"

PARSER=""        # the working parser binary, or "jq"
PARSER_KIND=""   # "jq" | "py"

if command -v jq >/dev/null 2>&1; then
  if [ "$(printf '%s' "$PROBE" | jq -r '.tool_input.command // empty' 2>/dev/null)" = "__probe__" ]; then
    PARSER="jq"; PARSER_KIND="jq"
  fi
fi
if [ -z "$PARSER" ]; then
  for PY in python3 python py; do
    command -v "$PY" >/dev/null 2>&1 || continue
    if [ "$(printf '%s' "$PROBE" | "$PY" -c "$PY_EXTRACT" 2>/dev/null)" = "__probe__" ]; then
      PARSER="$PY"; PARSER_KIND="py"; break
    fi
  done
fi

# No working JSON parser -> do NOT pass silently. Block to stay safe (fail-closed).
if [ -z "$PARSER" ]; then
  echo "Hook requires a working 'jq' or Python 3 to parse the event. Blocking to stay safe." >&2
  echo "Install jq (apt/brew install jq) or ensure 'python' runs real Python 3." >&2
  exit 2
fi

# --- Extract the command -----------------------------------------------------
if [ "$PARSER_KIND" = "jq" ]; then
  CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
else
  CMD=$(printf '%s' "$INPUT" | "$PARSER" -c "$PY_EXTRACT" 2>/dev/null)
fi

# No command extracted (not a Bash tool call with .command) -> allow.
if [ -z "$CMD" ] || [ "$CMD" = "null" ]; then
  exit 0
fi

# --- Policy: "dangerous by policy" patterns — always block -------------------
# Patterns are SPECIFIC to avoid false positives
# (e.g. "npm run remove-cache" must NOT match the rm rule).
if echo "$CMD" | grep -qEi 'rm[[:space:]]+-[a-z]*r[a-z]*f|DROP[[:space:]]+TABLE|TRUNCATE[[:space:]]+TABLE|git[[:space:]]+push[[:space:]].*--force|git[[:space:]]+reset[[:space:]]+--hard|chmod[[:space:]]+-R[[:space:]]+777|curl[[:space:]].*\|[[:space:]]*sh|wget[[:space:]].*\|[[:space:]]*bash|mkfs|dd[[:space:]]+if='; then
  echo "BLOCKED by guardrail hook — dangerous command:" >&2
  echo "    $CMD" >&2
  echo "    If you truly need this, run it manually outside Claude Code." >&2
  exit 2
fi

exit 0
