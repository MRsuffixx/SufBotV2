#!/usr/bin/env bash
# Apply all pending Prisma migrations and report the result.
#
# Used in CI and in the dev docker compose override to ensure the
# database schema matches the repository's `prisma/schema.prisma` file.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
SCHEMA="$ROOT/packages/database/prisma/schema.prisma"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set; cannot run migrations" >&2
  exit 1
fi
if [ ! -f "$SCHEMA" ]; then
  echo "Schema file not found: $SCHEMA" >&2
  exit 1
fi

cd "$ROOT/packages/database"
echo "Applying migrations from $SCHEMA"
npx prisma migrate deploy --schema="$SCHEMA"
