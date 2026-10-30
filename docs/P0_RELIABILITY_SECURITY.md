# P0 reliability and security — PR #2 proposal

Base: latest `main` (`7f5c3f4`), including merged PR #1. No production database connection, SQL change, paid AI call or deployment occurred. The migration is a review artifact; human approval is still required.

## Implemented

- ESLint 9 flat configuration using Next core web vitals/TypeScript rules, explicit compatibility dependency, generated-file ignores, escaped JSX apostrophes and removal of the unused state setter. CI requires zero warnings, unit/component tests, disposable PostgreSQL tests, build and TypeScript.
- Atomic `file_memory` RPC, a capture version trigger and request idempotency replace the two-request app filing path. Owner RLS remains active under SECURITY INVOKER; no public/anon execution grant. The function locks the capture and validates/locks project ownership and workspace, requires explicit unfiling confirmation, and updates capture/history in one transaction. UI retries reuse request IDs for identical reviews. No non-atomic fallback is used.
- IndexedDB stores ordered audio chunks separately from draft metadata using strict transactions. Recording starts only after local metadata creation succeeds. Stop waits for queued writes. Recovery is scoped by current account/workspace; it rejects missing chunks, preserves original bytes and warns that interrupted audio can be incomplete. Failed writes stop capture and keep in-memory audio available for upload/download.
- Stable draft UUIDs define both storage path and capture ID. Retry never overwrites audio: ambiguous upload responses must match the downloaded audio's SHA-256; ambiguous capture responses must match owner/workspace/path. Local deletion follows remote confirmation, and an atomic byte comparison prevents deleting chunks appended during an upload by another tab. Explicit deletion remains a separate user-confirmed action. Closing the recorder retains local drafts rather than discarding them.
- Object URL/microphone cleanup, auth protection and existing project suggestion/confirmation behavior are retained. No paid model dependency was added.

## Security audit scope

The cloud machine has no Supabase secret/variable bindings or local `.env.local`, and no connected Supabase inspection tool. Thus live grants, invite-only settings, deployed Storage policies, migration versions, extension placement and `rls_auto_enable()` cannot be verified here. `security_inventory.sql` is supplied for a read-only, authorized Aura-only inventory. No credentials should be pasted into chat or this public PR.

The migration adds/validates a history capture-owner FK and qualifies the insert policy's owner correlation. Historical owner-scoped table RLS and storage-prefix policies were executed in a disposable PostgreSQL fixture. Tests exercise anon even with simulated default table grants; authenticated users cannot read/write another user's records or storage prefix. The fixture supplies minimal `auth.uid()`, roles and Storage metadata tables. It does **not** run Supabase Auth/PostgREST/Storage services: signed URLs, actual bucket MIME/size enforcement, upload endpoints, current production grants and negative API requests still require staging/live acceptance.

`tasks.source_capture_id` still lacks a composite owner FK; direct owner history writes remain possible and are not tamper-evident. Same-owner cross-workspace relationships outside the filing RPC remain a broader schema consideration. Existing normalized alias conflicts can race. Unknown live permissive policies or privileged functions must be inspected before production approval rather than assumed safe or removed blindly.

## Migration and rollout

Proposed migration: `20261030040000_atomic_memory_filing.sql`. Adds `captures.filing_version`, ownership/history retry metadata and constraints, a version trigger, qualified history policy and the RPC. It does not modify historical migration files or Storage policies. Existing incompatible data/names can abort application; no repair/delete of production data is automated.

Review, staged acceptance, rollout order and a non-destructive rollback are in `supabase/review/ATOMIC_FILING_REVIEW.md`. Reconcile deployed schema/history first, obtain human approval, test on authorized staging, then apply this one reviewed migration before deploying the app. Verify PostgREST schema cache, grants and the correct Vercel commit. Deploying the app before the version column/RPC is available breaks memory loading/filing. Old clients retain non-atomic filing behavior until retired. Rollback preserves all decisions and retry/version data; it requires application rollback first and a new forward migration for repair.

## Recording safety limits

Committed chunks survive IndexedDB close/reopen in tests; no real-device crash-safe claim is made. Browser eviction, cleared/private storage, disk failure, final uncommitted chunks, codec/container behavior after truncation and mobile background termination can lose data or make recovery unplayable. Requesting persistent storage can be denied. Quota failure retains in-memory rescue audio, but a subsequent crash can lose those uncommitted bytes. Browser data is unencrypted and accessible to the browser profile/origin; account filtering is not cryptographic isolation. Make that privacy tradeoff explicit on shared devices.

Simultaneous tabs are not fully coordinated: cleanup refuses to delete changed persisted bytes, but an active recorder and recovery/upload tab can still conflict. Close other recorder tabs before recovery. Audio remains in memory during recording, so long recordings need backpressure/streaming and device memory limits. No background upload scheduler or encrypted backup/restore is included. Keep all release gates open until real-browser/device, long-audio, quota/eviction, process-kill/reload/playback and hosted service acceptance pass.

## Validation

Final command results and the complete changed-file inventory are recorded in the accompanying PR description. Database tests accept no database URL and run solely in a throwaway, network-isolated, digest-pinned PostgreSQL/pgvector container. They test synthetic two-user isolation, storage prefixes, RPC grants, owner/workspace rejection, explicit unfiling, raw/corrected/audio provenance, idempotency, stale/ABA edits, history-error rollback, competing transactions and rollback preservation. Unit/component tests cover local draft reopen/order/isolation/deletion, pending writes, quota-start failure, recovery warnings, failed upload retention and byte-verified retry behavior.

Hosted GitHub CI, production deployment, actual Auth/Storage API requests and live migration reconciliation have not been verified. See the PR for exact local results rather than inferring production readiness from passing mocks.

## Local results and complete file inventory

- Baseline merged main: 59 tests, TypeScript and production build passed before behavior changes.
- Final application suite: 75 tests passed in 11 files; no skipped tests.
- ESLint: passed with zero warnings. TypeScript and production build passed.
- Disposable PostgreSQL migration/RLS/atomicity/concurrency/rollback suite: passed, including rollback when existing triggers silently suppress writes.
- Production-build HTTP smoke: `/`, `/auth/reset`, `/robots.txt` return 200 with COOP/COEP headers; legacy transcription returns expected 503 without a paid provider key.
- Dependency audit: zero known vulnerabilities at the time of check.
- Hosted GitHub API access is forbidden in this environment; branch/PR publication results are reported separately. No hosted CI or production-readiness claim is made.

Every modified/added file in this proposal (generated `next-env.d.ts` edits are restored):

- `.github/workflows/ci.yml`
- `README.md`
- `docs/P0_AUDIT.md`
- `docs/P0_RELIABILITY_SECURITY.md`
- `docs/PRODUCT_AND_ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `eslint.config.mjs`
- `package-lock.json`
- `package.json`
- `scripts/test-database.sh`
- `src/app/page.tsx`
- `src/components/filing-review.tsx`
- `src/components/knowledge-workspace.tsx`
- `src/components/voice-capture.tsx`
- `src/components/workspace-bootstrap.tsx`
- `src/lib/memory-filing.ts`
- `src/lib/recording-drafts.ts`
- `src/lib/upload-recording.ts`
- `supabase/migrations/20261030040000_atomic_memory_filing.sql`
- `supabase/review/ATOMIC_FILING_REVIEW.md`
- `supabase/review/rollback_atomic_memory_filing.sql`
- `supabase/review/security_inventory.sql`
- `supabase/tests/bootstrap.sql`
- `supabase/tests/security.sql`
- `tests/filing-review.test.tsx`
- `tests/memory-filing.test.ts`
- `tests/recording-drafts.test.ts`
- `tests/recording-lifecycle.test.tsx`
- `tests/upload-recording.test.ts`
- `tests/voice-recovery.test.tsx`
