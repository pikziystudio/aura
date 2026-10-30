# P0 prototype audit — 2026-10-30

Scope: repository `main` at `ef995e2`, audited against `AGENTS.md`, `PRODUCT_AND_ARCHITECTURE.md` and `ROADMAP.md`. This is a code and local-runtime audit, not production security acceptance. No database was connected to or changed, no migrations were applied, and no production deployment was performed. Synthetic fixtures only. No paid AI dependency was added.

## Reproduced and addressed

- Original `findProjects('Discuss D-R Mind tomorrow.', [{id: 'synthetic', name: 'DearMind'}], [])` returned zero candidates. Matching is now a pure module with token boundaries, CamelCase/spacing handling, Unicode text, generic conservative spelling/phonetic candidates, explicit evidence, and multiple-candidate ambiguity. `your mind` remains weak and requires nearby project context. Suggestions never assign a UUID automatically. Phonetic heuristics are English-oriented, not semantic understanding or Hindi recognition acceptance.
- Both alias-confirmation paths now check normalized conflicts against known canonical names and existing aliases. They still require a user action. Existing database conflicts remain multiple candidates, not forced matches. Database uniqueness across normalized aliases still needs review to prevent simultaneous conflicting insertions.
- Previously, clicking Keep in Inbox immediately cleared a previously assigned project. A separate removal checkbox is now required, and persistence independently enforces the confirmation.
- Previously, a zero-row capture update could still insert history/report completion. Filing now requires an updated row, verifies the current user and selected/suggested project's workspace, and uses original title/project/status as optimistic predicates. A stale view or denied write cannot report success. Audio, raw transcript and human correction are absent from the filing payload.
- Title suggestions previously removed the final word even when a short sentence fit the limit. Short first sentences are now kept intact; no AI-generated facts are added.
- Preview object URLs were allocated during every render and never revoked. They now follow the Blob lifecycle. Unsaved recordings warn on dialog close and before tab navigation. Permission resolving after unmount releases the microphone. Browser unload warnings are best effort and do not provide crash recovery or prevent all mobile tab termination.
- The recovery page previously threw when auth configuration was absent and retained the password form after sign-out. It now handles configuration/network failure, clears the form after sign-out and ignores stale initial session responses. AuthGate also ignores stale initial session responses after auth events; switching accounts remounts private workspace state.
- Configuration rejects a different Supabase project and privileged/non-anon key types in browser and legacy server transcription paths. This guard is not JWT signature verification (Supabase performs authentication), and cannot undo a secret already compiled into a browser bundle. Rotate any privileged credential ever deployed under a NEXT_PUBLIC variable.
- Added locked dependencies, Vitest/Testing Library and CI for unit, component and mocked persistence/API integration tests. The initial test-runner dependency audit exposed advisories; patched Vitest and a compatible PostCSS 8 override removed all reported advisories without a Next.js major upgrade. Reassess the override when upgrading Next.js.

## Authentication and Supabase security: source evidence

| Area | Evidence in source | Remaining verification/risk |
| --- | --- | --- |
| Auth | Supabase password sign-in/reset; workspace bootstrap calls `getUser`; API validates bearer via `getUser` | Invite-only is UI intent, not enforcement. Check Supabase signup/invite settings, recovery redirect allowlist, session expiry/revocation and MFA policy in the dedicated Aura project. |
| User tables | Initial migration enables RLS on workspaces/projects/captures/tasks with owner checks, including update `WITH CHECK` | Live policies, grants, applied migration versions and two-user negative tests unavailable. Repository SQL is not proof of deployed permissions. |
| Ownership FKs | Workspace/project composite owner constraints protect main relationships | Same-owner project can be in another workspace at the database level. Filing adds a client check; this is not a substitute for a database constraint or secure RPC. `tasks.source_capture_id` lacks a composite owner FK. Review before task workflow ships. |
| Aliases | Owner RLS and project/owner FK; writes require confirmation | Uniqueness is case-sensitive per project, so concurrent normalized conflicts remain possible. No automatic learning was introduced. |
| Filing history | Owner RLS and project/owner FK; insert policy checks for a visible capture | `filing_decisions.capture_id` lacks a composite owner FK. The policy's unqualified inner `owner_id` is ambiguous to readers; inner capture RLS currently matters. Qualify outer/inner references in a reviewed migration and verify against live policies/grants. Do not infer an exploit or safety from text alone. |
| Recording storage | Migration makes `aura-recordings` private; authenticated owner-prefix read/insert/delete policies, 50 MiB limit and audio MIME allowlist. Signed playback expires after 300 seconds | Confirm live bucket settings, all permissive policies, grants and signed URL behavior. No authenticated cross-user storage requests were run. Capture path text alone is not bound to owner by a table constraint; storage RLS is essential. |
| Server transcription | Legacy optional route validates user, capture owner filter, audio owner path, MIME and size. No service-role key is used | Local browser Whisper remains the normal flow. Do not enable or pay for the legacy provider to run tests. This PR does not verify quota, model downloads, privacy of third-party model assets or real transcription accuracy. |
| Reported prior advisories | `vector` extension and `rls_auto_enable()` were mentioned in the architecture brief but are not defined in checked-in migrations | Inspect live extension schemas, `pg_proc.prosecdef`, function body/search_path, grants to public/anon/authenticated, and usage before proposing a migration. No live function or permission claim is made here. |

## Remaining blockers and next steps

1. **Atomic filing and history:** capture update and history insert still span separate requests. History failure is explicitly reported after capture success, not rolled back blindly. Current optimistic predicates do not protect against all ABA edits or a second writer between capture/history operations. Design an owner-scoped transactional function with expected version, project/workspace validation and explicit grants; submit a versioned migration, rollback plan and two-session tests for review before applying. Do not rerun historical migrations.
2. **Reconcile live schema:** read migration history and catalog for Aura only; compare all four checked-in versions, composite FKs, RLS policies, roles/grants and private storage configuration. Missing Supabase bindings/authorized test accounts prevented this step. No service-role credentials should be put into the browser or this public repository.
3. **Negative security acceptance:** use two disposable authorized Aura test accounts with synthetic data. As anon and user B, attempt select/insert/update/delete of A's captures/projects/workspaces/aliases/history and list/download/upload/delete under A's storage prefix. Verify own-user operations still work. Test spoofed owner IDs, project/capture references, token expiry and cross-workspace selections. These local mocks test application guards, not the database's enforcement.
4. **Durability:** recording remains memory-only until upload. Add persistent chunks, crash/cold-start recovery, idempotent upload retries and orphan cleanup. Upload and capture insert are also separate requests. Closing during an upload may still finish one request. Do not call this offline-safe.
5. **Transcription/correction concurrency:** existing local/server transcript writes use a null predicate but do not check a returned row. Existing correction flow and alias inference remain limited (including multiple edits and CamelCase alignment). Add versioned saves and race tests; do not overwrite original audio/raw text. Browser model download/cache/OPFS, long recordings and Hindi/Hinglish need device acceptance.
6. **Tooling:** `npm run lint` currently fails because ESLint 9 has no configuration. Establish the intended lint rules in a follow-up. New CI deliberately runs tests/build/typecheck and does not claim lint success. CI has been authored but its GitHub execution is not yet observed.
7. **Release gates:** encrypted backups/restore, Windows and Android packages, accessibility/device/browser acceptance, real authenticated flows and correct-commit Vercel deployment remain unverified. No release-readiness claim.

## Reproduction and validation

Validated with Node 24.19.0/npm 11.9.0. Install: `ONNXRUNTIME_NODE_INSTALL=skip npm ci --no-audit --no-fund`. The supported ONNX setting omits optional native CUDA binaries; browser inference does not need them. Keep package integrity and TLS verification enabled. Build/typecheck of unmodified main passed before changes. No existing test suite was present.

Final validation in this cloud instance:

| Check | Result |
| --- | --- |
| Clean `ONNXRUNTIME_NODE_INSTALL=skip npm ci --no-audit --no-fund` | Passed; 438 packages installed |
| `npm test` | Passed; 59 tests across 8 files, no skipped tests |
| `npm run typecheck -- --incremental false` | Passed, including after restoring generated next-env changes |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | Passed on Next.js 15.5.28 |
| `npm audit --json` | Zero known vulnerabilities at time of check |
| Production server HTTP smoke checks | `/`, `/auth/reset`, `/robots.txt`: 200 and configured COOP/COEP headers; legacy POST `/api/transcribe`: expected 503 without optional provider key |
| `npm run lint` | Failed: missing ESLint 9 configuration (existing repository gap) |
| Live Supabase RLS/auth/storage, production deployment | Not run: credentials/accounts unavailable; no production access attempted |
| GitHub CI | Workflow added; hosted execution not yet verified |

 Tests cover synthetic pronunciation/spacing/ambiguity and aliases, explicit UI confirmation, mocked owner/workspace checks and failed/partial writes, auth account/session changes, recovery errors, recording cleanup/navigation, and legacy API pre-provider security guards. None contact Supabase, an AI provider, or real user data. CI uses Node 24 and the lockfile with the same ONNX option.

Next.js regenerates tracked `next-env.d.ts`; its generated edits are excluded from this change. Avoid committing credentials, recordings, exports or screenshots containing user data.
