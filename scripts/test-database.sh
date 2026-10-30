#!/usr/bin/env bash
# No database URL is accepted: this runner only uses its own throwaway container.
set -euo pipefail
cd "$(dirname "$0")/.."
container="aura-security-test-${RANDOM}-$$"
docker_cmd=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
cleanup() { "${docker_cmd[@]}" rm -f "$container" >/dev/null; }
trap cleanup EXIT
"${docker_cmd[@]}" run -d --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust pgvector/pgvector:pg17@sha256:ac08538c6f8b9904c33c8224c5e5706dbe760aca29db1d096972b4052c22a75d >/dev/null
ready=false
for attempt in {1..30}; do
 if "${docker_cmd[@]}" exec "$container" pg_isready -U postgres >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
[ "$ready" = true ] || { echo 'Disposable database failed to start'; exit 1; }
psql_local() { "${docker_cmd[@]}" exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
psql_local < supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do psql_local < "$migration"; done
psql_local < supabase/tests/security.sql
# Competing sessions must not both file the same capture version.
log=$(mktemp)
trap 'rm -f "$log"; cleanup' EXIT
psql_local >"$log" <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.file_memory('30000000-0000-4000-8000-000000000003',0,'40000000-0000-4000-8000-000000000030','file','20000000-0000-4000-8000-000000000001','First',null,null,false);
\echo LOCKED
select pg_sleep(1);
commit;
SQL
first_pid=$!
for attempt in {1..50}; do
 if grep -q LOCKED "$log"; then break; fi
 sleep 0.1
done
grep -q LOCKED "$log"
psql_local <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000003',0,'40000000-0000-4000-8000-000000000031','file','20000000-0000-4000-8000-000000000001','Second',null,null,false)$q$,'40001');
select public.assert_true((select count(*)=1 from public.filing_decisions where capture_id='30000000-0000-4000-8000-000000000003'),'one concurrent decision');
SQL
wait "$first_pid"
psql_local < supabase/review/rollback_atomic_memory_filing.sql
psql_local <<'SQL'
select public.assert_true(to_regprocedure('public.file_memory(uuid,bigint,uuid,text,uuid,text,text,uuid,boolean)') is null,'rollback removes RPC');
select public.assert_true((select count(*)=1 from public.filing_decisions where capture_id='30000000-0000-4000-8000-000000000003'),'rollback preserves decision history');
SQL
printf '%s\n' 'Database security, rollback, and concurrent filing checks passed.'
