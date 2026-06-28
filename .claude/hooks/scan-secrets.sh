#!/bin/bash
# PostToolUse hook (optional, advanced) — warns if a just-edited file exposes a secret pattern.
# Note: PostToolUse runs AFTER the edit -> it can only warn, it cannot undo. Exit 0 always
# (advisory only: it must never block a write).

INPUT=$(cat)

# Probe-validated parser selection (same Windows-stub guard as block-dangerous.sh).
PROBE='{"tool_input":{"file_path":"__probe__"}}'
PY_EXTRACT="import sys,json;print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))"

PARSER=""; PARSER_KIND=""
if command -v jq >/dev/null 2>&1; then
  if [ "$(printf '%s' "$PROBE" | jq -r '.tool_input.file_path // empty' 2>/dev/null)" = "__probe__" ]; then
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
# Advisory hook: if no parser is available, do nothing (never block a write).
[ -z "$PARSER" ] && exit 0

if [ "$PARSER_KIND" = "jq" ]; then
  FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE=$(printf '%s' "$INPUT" | "$PARSER" -c "$PY_EXTRACT" 2>/dev/null)
fi

[ -z "$FILE" ] || [ ! -f "$FILE" ] && exit 0

# Secret patterns tuned for this stack (MySQL + Shopify), plus common keys/credentials.
if grep -qEi 'sk_live_|shpat_|shpss_|SHOPIFY_API_SECRET[[:space:]]*=|api[_-]?key[[:space:]]*=|password[[:space:]]*=|BEGIN (RSA|OPENSSH) PRIVATE KEY|mysql://[^[:space:]]*:[^[:space:]]*@|postgres://[^[:space:]]*:[^[:space:]]*@' "$FILE"; then
  echo "WARNING: file $FILE may contain a secret. Review it before committing." >&2
fi
exit 0
