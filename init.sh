#!/usr/bin/env bash
# init.sh — Environment + Feedback: set up and verify the whole stack from a clean checkout.
# Numbered steps; must stay in sync with package.json scripts and the Makefile targets.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }

# ---------------------------------------------------------------------------
step "1/9 Check Node 22"
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node not found. Install Node 22 (see .nvmrc) and retry." >&2
  exit 1
fi
WANT_NODE="$(tr -dc '0-9' < .nvmrc 2>/dev/null || echo 22)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" != "$WANT_NODE" ]; then
  echo "Error: need Node $WANT_NODE (current $(node -v)). Run: nvm use" >&2
  exit 1
fi
echo "Node $(node -v) OK"

# ---------------------------------------------------------------------------
step "2/9 Check Go"
if ! command -v go >/dev/null 2>&1; then
  echo "Error: Go not found. Install Go 1.21+ and retry." >&2
  exit 1
fi
echo "$(go version) OK"

# ---------------------------------------------------------------------------
step "3/9 Prepare per-tier .env files"
# Each tier owns its own .env (backend = secrets + DB; frontend/storefront = public only).
cp -n backend/.env.example backend/.env
[ -d frontend ] && cp -n frontend/.env.example frontend/.env
[ -d storefront ] && cp -n storefront/.env.example storefront/.env
# Load backend env so the steps below see the real DB_* (MySQL health check).
# Safe loader: export ONLY well-formed KEY=value lines. A malformed line in a hand-edited
# .env (e.g. a value pasted without KEY=) must never be executed as a command.
set -a
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"                       # tolerate CRLF
  case "$line" in
    ''|'#'*) continue ;;                      # skip blank + comments
    [A-Za-z_]*'='*) export "$line" ;;         # only KEY=value
    *) echo "  (skipping malformed backend/.env line: $line)" >&2 ;;
  esac
done < ./backend/.env
set +a
echo "per-tier .env files ready"

# ---------------------------------------------------------------------------
step "4/9 Start MySQL (docker compose)"
docker compose up -d db

# ---------------------------------------------------------------------------
step "5/9 Wait for MySQL healthy"
# Probe matches the docker-compose healthcheck (app user, not root). No curl/wget —
# the health check goes through `docker compose exec`.
DB_USER="${DB_USER:-app}"
DB_PASSWORD="${DB_PASSWORD:-app_pass}"
ATTEMPTS=60
until docker compose exec -T db \
        mysqladmin ping -h 127.0.0.1 -u"$DB_USER" -p"$DB_PASSWORD" --silent >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS - 1))
  if [ "$ATTEMPTS" -le 0 ]; then
    echo "Error: MySQL not healthy in time. See: docker compose logs db" >&2
    exit 1
  fi
  printf '.'
  sleep 2
done
echo ""
echo "MySQL healthy (db=${DB_NAME:-announcement_bar}, host=${DB_HOST:-127.0.0.1}, port=${DB_PORT:-3307}, user=${DB_USER})"

# ---------------------------------------------------------------------------
step "6/9 Schema (no separate migrate step)"
echo "Backend GORM-auto-migrates on boot (and in DB tests) — no golang-migrate step."

# ---------------------------------------------------------------------------
step "7/9 Backend test + build"
# EXPECTED controlled-RED until feat-001 creates backend/: halt clearly when the Go tier is absent.
if [ ! -d backend ]; then
  echo "Error: backend/ does not exist yet - build the Go tier in feat-001." >&2
  exit 1
fi
(
  cd backend
  # Run tests, capturing output. On Windows, `go test` can fail to delete its temp
  # test binary when Defender briefly locks it ("unlinkat ... .test.exe ... being used
  # by another process") and exit non-zero EVEN THOUGH every test passed. We tolerate
  # ONLY that specific cleanup artifact; any real test FAIL still aborts the harness.
  out="$(go test ./... 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    if printf '%s\n' "$out" | grep -qE '^(--- FAIL|FAIL)'; then
      echo "Backend tests FAILED." >&2; exit 1
    elif printf '%s\n' "$out" | grep -q 'unlinkat.*\.test\.exe.*another process'; then
      echo "(Note: ignored a benign Windows temp-file cleanup lock; all tests passed.)" >&2
    else
      echo "go test failed (rc=$rc)." >&2; exit 1
    fi
  fi
  go build ./...
)

# ---------------------------------------------------------------------------
step "8/9 Frontend install"
if [ ! -d frontend ]; then
  echo "Error: frontend/ does not exist yet - build the admin tier in feat-001." >&2
  exit 1
fi
( cd frontend && npm ci )

# ---------------------------------------------------------------------------
step "9/9 Storefront install"
if [ ! -d storefront ]; then
  echo "Error: storefront/ does not exist yet - build the storefront tier in feat-001." >&2
  exit 1
fi
( cd storefront && npm ci )

# ---------------------------------------------------------------------------
bold ""
bold "================ HARNESS GREEN ================"
echo ""
echo "Environment ready and clean. Next: open .claude/feature_list.json, pick exactly ONE"
echo "not-started feature whose dependencies are all done (start: feat-001), set it in-progress,"
echo "build it, then re-run 'bash init.sh' and paste the output into its evidence field."
