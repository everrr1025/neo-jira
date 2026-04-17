#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d /tmp/neo-jira-migrate-XXXXXX)"
FRESH_DB="$TMP_ROOT/fresh.db"
FRESH_SHADOW_DB="$TMP_ROOT/fresh-shadow.db"
BASELINE_DB="$TMP_ROOT/baseline.db"
BASELINE_SHADOW_DB="$TMP_ROOT/baseline-shadow.db"
INIT_MIGRATION="20260417000000_init"

cleanup() {
  rm -rf "$TMP_ROOT"
}

trap cleanup EXIT

run_empty_diff_check() {
  local db_path="$1"
  local shadow_path="$2"
  local diff_output

  diff_output="$(cd "$ROOT_DIR" && npx prisma migrate diff \
    --from-migrations prisma/migrations \
    --to-url "file:$db_path" \
    --shadow-database-url "file:$shadow_path" \
    --script)"

  if [[ "$diff_output" != "-- This is an empty migration." ]]; then
    echo "Migration diff is not empty for $db_path"
    echo "$diff_output"
    exit 1
  fi
}

echo "==> Verifying fresh database deploy flow"
touch "$FRESH_DB" "$FRESH_SHADOW_DB"
(cd "$ROOT_DIR" && env DATABASE_URL="file:$FRESH_DB" npx prisma migrate deploy --schema prisma/schema.prisma)
run_empty_diff_check "$FRESH_DB" "$FRESH_SHADOW_DB"

echo "==> Verifying baseline flow for an existing SQLite database"
touch "$BASELINE_DB" "$BASELINE_SHADOW_DB"
sqlite3 "$BASELINE_DB" ".read $ROOT_DIR/prisma/migrations/$INIT_MIGRATION/migration.sql"
(cd "$ROOT_DIR" && env DATABASE_URL="file:$BASELINE_DB" npx prisma migrate resolve --applied "$INIT_MIGRATION" --schema prisma/schema.prisma)
(cd "$ROOT_DIR" && env DATABASE_URL="file:$BASELINE_DB" npx prisma migrate deploy --schema prisma/schema.prisma)
run_empty_diff_check "$BASELINE_DB" "$BASELINE_SHADOW_DB"

echo "Migration verification passed."
