# Atomic filing migration — review and deployment gate

**Status: proposed, locally tested; human approval and live-schema reconciliation pending.** No production SQL has been executed. Local test review does not constitute database-owner approval.

Migration: `20261030040000_atomic_memory_filing.sql`. Depends on all four historical migrations being present in the actual Aura schema; do not rerun them to fix filenames/history mismatches. The PR is the review artifact, not permission to apply it.

## Design review

- `file_memory` is SECURITY INVOKER, with an empty search path, schema-qualified application objects and explicit current-user ownership checks. Existing RLS remains active. PUBLIC and anon lose function execution; authenticated alone receives it. There is no service-role browser key or privileged bypass.
- Row lock serializes edits on a capture. An incrementing version trigger covers every update, including ABA changes; the RPC checks the version after locking. Shared locks hold selected/suggested projects in the validated workspace until commit.
- Capture update and decision insert execute in one PostgreSQL transaction. A decision insertion error rolls both back, including the version increment. Explicit row/result guards also reject triggers that silently suppress an update or insert; those cases have rollback regression tests. Stable request UUID plus full normalized request payload makes retries after lost network responses idempotent. Reusing an ID for a different payload is rejected.
- Only title, selected/suggested project and filing state change. Audio path, raw transcript and human correction are preserved. Removing an existing project requires an explicit flag in the RPC as well as the UI checkbox.
- Adds a composite capture-owner FK to history and qualifies the history policy's owner references. The FK is validated; existing inconsistent rows cause the migration transaction to abort rather than being silently rewritten/deleted. Existing old decisions have null retry metadata and remain intact.
- No storage policies, extension placement, unrelated SECURITY DEFINER functions or historical migrations are modified. Their live definitions are unknown. Direct owner edits/history inserts retain existing grants; this is an atomic app filing API, not a tamper-proof audit log.
- Version trigger function is not callable by anon/authenticated, but PostgreSQL can execute it through the trigger. Tests cover this behavior.

## Required before approval

- [ ] Confirm the target connection is dedicated Aura `rwivnjxlmjctjdbxlfxf`, not PikZiy Books.
- [ ] Run `security_inventory.sql` read-only, reconcile actual versions/columns/grants/policies, and inspect deployed routines. Sanitize metadata before attaching it to the public PR.
- [ ] Check for incompatible existing `filing_version`, constraint, trigger or RPC names; inspect FK violations with an authorized operator. Do not delete or rewrite inconsistent history automatically.
- [ ] Review `vector` schema and `rls_auto_enable()` definition/search_path/ACL/usage. Do not change them based only on prior advisory text.
- [ ] Test on an authorized disposable Supabase staging project, including actual PostgREST RPC, JWT roles, private Storage API byte/MIME/size handling and two synthetic users. Our local fixture tests PostgreSQL policies but not the hosted services.
- [ ] Review migration lock duration/table sizes and maintenance needs, backup/recovery evidence and rollback application version. Validated FK/index creation and trigger installation can block writes.
- [ ] Database owner reviews and explicitly approves production application.

## Deployment order after approval

1. Preserve verified backups and record the deployed application commit and applied migration history. Use existing approved secrets; never add privileged NEXT_PUBLIC variables.
2. Apply this one migration once to approved staging. Run security tests and real auth/RPC/storage acceptance. Reconcile the migration tracking record using the team's approved process.
3. After explicit production approval, apply the reviewed migration to Aura, reload/verify PostgREST's schema cache if required, and verify function grants/RLS/version trigger. Do not weaken RLS if an RPC call fails.
4. Deploy the new app only after the RPC and version column are available. New app filing has no non-atomic fallback. Old clients can still write fields directly; the trigger advances versions but cannot make historical two-request filing atomic. Coordinate retirement of old clients for full acceptance.
5. Verify the correct Vercel commit is READY and exercise filing/retry/recovery with synthetic data. No deployment was performed during this task.

## Rollback

`rollback_atomic_memory_filing.sql` removes only the new RPC/trigger/function, retaining version/retry metadata, history and ownership constraints. It is tested against the disposable PostgreSQL fixture. Stop writes and deploy the prior app first; it uses the old non-atomic filing behavior and should not be represented as equally safe. Back up metadata before any subsequent cleanup. A forward repair needs a new reviewed migration; do not rerun this partially retained migration after rollback. Do not drop data columns to make reapplication succeed.

## Evidence and limits

Run `npm run test:database`: it accepts no database URL and starts its own network-isolated, pinned PostgreSQL/pgvector Docker container. It applies the historical SQL to synthetic Supabase auth/storage contracts and then the proposed migration. Tests cover ownership, storage prefixes, RPC grants, stale/ABA versions, same-request replay, mismatched retry payload, explicit unfiling, rollback on forced history failure, concurrent filing and rollback preservation. It cannot establish live migration parity, hosted Storage service behavior or production security.
