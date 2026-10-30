#!/usr/bin/env bash
# One-time, backwards-compatible dev rollout of the registration changes migration.
# Called only with SUPABASE_DB_URL_DEV, after the backup is saved privately.
# No database contents or connection details may appear in the public workflow log.
set -euo pipefail
url=$1
migration=$2
backup=$3

state=$(psql "$url" --no-psqlrc -Atq -v ON_ERROR_STOP=1 -c "
  select case
    when to_regprocedure('public.apply_registration_changes(text,text,text,jsonb,boolean,boolean,integer)') is null then 'pending'
    when exists (select 1 from pg_index where indexrelid = to_regclass('public.athletes_active_identity_key') and indisvalid)
      and (select count(*) from pg_trigger where not tgisinternal and tgname in ('athlete_registration_active','registration_active')) = 2
      then 'ready' else 'incomplete' end" 2>/dev/null) || {
  echo "::error::Cannot check dev schema. Check project availability and the dev connection secret."
  exit 1
}
if [ "$state" = ready ]; then
  echo "Dev registration changes schema is already installed."
  exit 0
fi
if [ "$state" != pending ]; then
  echo "::error::The dev registration changes schema is incomplete; review it before retrying."
  exit 1
fi

mkdir -p "$backup/before-registration-changes"
for file in database.sql.gz data.sql.gz registrace.csv audit_log.csv; do
  cp -n "$backup/$file" "$backup/before-registration-changes/$file"
done

# One transaction and an advisory lock make retries safe. The migration itself
# refuses existing identity duplicates without merging, deleting or cancelling data.
if ! {
  echo 'begin;'
  echo "set local lock_timeout = '20s';"
  echo "set local statement_timeout = '120s';"
  echo "select pg_advisory_xact_lock(hashtext('cwo-schema:registration-changes'));"
  echo "select to_regprocedure('public.apply_registration_changes(text,text,text,jsonb,boolean,boolean,integer)') is null as pending \gset"
  echo '\if :pending'
  cat "$migration"
  echo '\endif'
  echo 'commit;'
} | psql "$url" --no-psqlrc -q -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
  echo "::error::Dev migration failed and was rolled back. Review active duplicates, schema permissions and the private pre-migration backup."
  exit 1
fi
echo "Dev registration changes migration applied in one transaction."
