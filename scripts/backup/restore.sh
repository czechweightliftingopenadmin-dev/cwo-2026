#!/usr/bin/env bash
# Replaces all registration data in a database with a backup made by dump.sh.
# Usage: restore.sh <database-url> <backup-dir>
# The schema must already exist (supabase/migrations). Runs in one transaction: either the
# whole backup is restored, or nothing changes. Triggers are off during the load, so the
# restore does not add audit entries and the saved history comes back as it was.
set -euo pipefail
url=$1
dir=$2

{
  echo "set session_replication_role = replica;"
  echo "truncate public.email_log, public.lookup_attempts, public.startlist_snapshots,"
  echo "  public.audit_log, public.athletes, public.registrations restart identity;"
  gzip -dc "$dir/data.sql.gz"
} | psql "$url" -v ON_ERROR_STOP=1 -q --single-transaction > /dev/null

psql "$url" -At \
  -c "select 'Restored: ' || (select count(*) from public.registrations) || ' registrations, '
        || (select count(*) from public.athletes) || ' athletes, '
        || (select count(*) from public.audit_log) || ' history entries'"
