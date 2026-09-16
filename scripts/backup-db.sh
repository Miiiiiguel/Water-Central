#!/usr/bin/env bash
# Manual/scheduled backup of the Supabase Postgres database.
#
#   SUPABASE_DB_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres" pnpm backup:db
#
# The connection string is in Supabase -> Project Settings -> Database.
# Needs `pg_dump` installed (brew install libpq / apt install postgresql-client).
# Output: backups/easycomex-YYYYMMDD-HHMMSS.sql.gz — keep these somewhere
# encrypted and off this machine (they contain customer data).
#
# Restore into an empty database:
#   gunzip -c backups/easycomex-....sql.gz | psql "$SUPABASE_DB_URL"
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is not set." >&2
  exit 1
fi

mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
out="backups/easycomex-${stamp}.sql.gz"

pg_dump "$SUPABASE_DB_URL" \
  --schema=public --schema=auth \
  --no-owner --no-privileges \
  | gzip > "$out"

echo "Backup written to $out ($(du -h "$out" | cut -f1))"
