#!/usr/bin/env bash
# Backs up the registration database. Usage: dump.sh <database-url> <output-dir>
# Writes database.sql.gz (schema and data, for reference), data.sql.gz (data only, for
# restore.sh) and CSV exports. Prints nothing from the data: the workflow log is public.
set -euo pipefail
url=$1
out=$2
mkdir -p "$out"

pg_dump "$url" --schema=public --no-owner | gzip -9 > "$out/database.sql.gz"
pg_dump "$url" --schema=public --data-only --no-owner | gzip -9 > "$out/data.sql.gz"
psql "$url" -v ON_ERROR_STOP=1 -q \
  -c "\copy (select * from public.registrations_overview) to '$out/registrace.csv' csv header" \
  -c "\copy (select * from public.audit_log order by id) to '$out/audit_log.csv' csv header"

# A broken dump must fail loudly instead of being committed as a backup.
tables=$(gzip -dc "$out/database.sql.gz" | grep -c '^CREATE TABLE public\.' || true)
if [ "$tables" -lt 6 ]; then
  echo "Backup looks incomplete: $tables tables in the dump" >&2
  exit 1
fi
echo "Backup written: $tables tables, $(du -sh "$out" | cut -f1)"
