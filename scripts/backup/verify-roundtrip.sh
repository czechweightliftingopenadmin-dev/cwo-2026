#!/usr/bin/env bash
# Proves a fresh backup restores to the same data: fingerprints the database, restores the
# backup over it with restore.sh and compares. Only for cwo-dev, never for production.
# Usage: verify-roundtrip.sh <database-url> <backup-dir>
set -euo pipefail
url=$1
dir=$2
here=$(dirname "$0")
fingerprint() {
  psql "$url" -At -c "select md5(coalesce(string_agg(t::text, '|' order by t.access_code, t.position), ''))
    || ':' || (select count(*) from public.audit_log) from public.registrations_overview t"
}

before=$(fingerprint)
bash "$here/restore.sh" "$url" "$dir"
after=$(fingerprint)
if [ "$before" != "$after" ]; then
  echo "::error::Restored data differs from the database it was backed up from"
  exit 1
fi
echo "Restore check passed: the backup restores to identical data"
