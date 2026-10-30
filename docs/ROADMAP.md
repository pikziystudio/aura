# AURA — Engineering Roadmap and Release Gates

**Reviewed:** 2026-10-30  
**How to use:** `[x]` means a repository feature exists or a limited test was reported; it does **not** imply production acceptance. `[ ]` means not yet accepted. Keep changes evidence-based, with commit/test/deployment links when closing items.

## P0 — Stabilize existing prototype (START HERE)
- [ ] Clone and install repo; reproduce `npm run typecheck` and `npm run build` on current main.
- [ ] Add automated test runner and CI for unit, integration and critical UI flows.
- [ ] Verify schema migrations against AURA Supabase migration history; reconcile filename/applied version mismatches without destructive reruns.
- [ ] Security audit of RLS, storage owner paths and previously flagged public `SECURITY DEFINER` function; avoid broad grants.
- [ ] Fix voice-capture audio object URL lifecycle and handle browser navigation/tab closure safely.
- [ ] Define recording and transcript lifecycle states with explicit errors and retry paths.
- [ ] Document secret/env configuration, rotate or remove unused OpenAI key, and ensure no secret is exposed client-side.
- [ ] Add a small synthetic dataset of similarly named projects/recordings for tests.
- [ ] Confirm Vercel deployment of tested commit and verify no cross-project data access.

### Current baseline, limited manual verification
- [x] Web preview and Supabase sign-in functioned.
- [x] Private audio upload and playback worked for a test recording.
- [x] Browser Whisper performed a successful English transcription without paid API credits.
- [x] Human transcript correction stored separately from raw machine output.
- [x] At least one filing and correction were saved in the development database.
- [ ] Cross-browser and Hindi/Hinglish accuracy acceptance complete.
- [ ] Cross-user isolation/security acceptance complete.

## P1 — Contextual Memory v1 (ACTIVE MILESTONE)
**Goal:** Record first; show useful title and project suggestions; confirm before filing; learn only verified aliases.

- [x] Add `project_aliases` with owner-scoped RLS.
- [x] Add filing status and decision history schema.
- [x] Add filing review UI and editable title/project.
- [x] Add initial normalized-name / DearMind variant heuristics.
- [x] Add opt-in alias suggestion after correction.
- [ ] Test `DearMind` vs `Dear Mind`, `Deer Mind`, `DR Mind`, `D-R Mind` and `your mind` with synthetic transcripts; distinguish strong/weak matches.
- [ ] Move name matching into pure `src/lib/project-matching.ts` with explicit scoring, ambiguity and test fixtures.
- [ ] Add general-purpose candidate matching (token edits + phonetic variants) with conservative thresholds; do not hardcode special names as main logic.
- [ ] Load aliases once per workspace, show alternatives and explain matching evidence.
- [ ] Ensure choosing Inbox does not inadvertently clear a previous confirmed project without explicit action.
- [ ] Make title suggestion more useful than truncating first sentence; no hallucinated contact/task.
- [ ] Make filing + history updates atomic and safe against concurrent edits.
- [ ] Provide undo/reopen filing and preserve decision/audit trail.
- [ ] Integrate review immediately post-transcription and provide a simple Inbox queue.
- [ ] Persist settings/model selection and confirm reliable OPFS model caching.
- [ ] On confirmed corrections, optionally remember matched alternative with safeguards against conflicting aliases.
- [ ] Responsive UI accessibility tests, including keyboard navigation and mobile layouts.
- [ ] Validate user ownership of selected project inside Supabase policies/functions.

### P1 acceptance examples
- [ ] `Deer Mind` leads to **DearMind** as a candidate, not a silently auto-assigned UUID.
- [ ] `D-R Mind` is recognized as a possible match where appropriate.
- [ ] A different similar project causes ambiguity rather than forced filing.
- [ ] Unknown project stays in Inbox; no invented projects.
- [ ] Confirm filing links to existing project UUID and writes consistent history.
- [ ] Human correction does not overwrite audio/raw transcript.
- [ ] Project alias is saved only after explicit confirmation and is reused.
- [ ] Record first without mandatory title/project; review later.

## P2 — Trustworthy recordings, offline sync and native foundations
- [ ] Persist chunks to IndexedDB/native filesystem during recording, not only on stop.
- [ ] Restore interrupted drafts after crash/restart, with tested recovery.
- [ ] Upload retry queue with idempotent record identifiers and orphan cleanup.
- [ ] Support long recordings via chunks and safe transcription queue.
- [ ] Time-synced transcript segments and evidence pointers.
- [ ] Select native architecture, create Windows and Android proof of concept and packaging.
- [ ] Verify microphone permissions, background restrictions and battery/resource requirements.

## P3 — Personal intelligence and project work
- [ ] Private, grounded local-first meeting/idea summaries with source references.
- [ ] Suggested tasks, contacts and decisions require explicit review.
- [ ] Search across notes, transcripts and project history.
- [ ] Optional semantic indexing and conflict-aware offline sync.
- [ ] Explainable automation with undo, no silent project creation.

## Release gates — MUST pass before relying on AURA for real client/personal data
- [ ] Security audit and negative RLS tests covering multiple user accounts.
- [ ] Crash-safe capture and demonstrated cold-start recovery.
- [ ] Authenticated upload/retry and no recording loss across offline transitions.
- [ ] Encrypted export and independently restorable backups, with a restore drill.
- [ ] Privacy policy, retention/deletion and access control reviewed.
- [ ] Reliability and accessibility testing on target Windows/Android hardware.
- [ ] Clear separation of provisional AI inference vs verified human fact.
- [ ] Acceptance tests and evidence documented; signed-off production release.

## Next Codex task (copy/paste)

> Audit the current `pikziystudio/aura` main branch against `docs/PRODUCT_AND_ARCHITECTURE.md`, `docs/ROADMAP.md`, and `AGENTS.md`. Start with P0: install, typecheck, build, inspect RLS/auth/recording and the project-matching/filing flow. Add runnable tests for text normalization, CamelCase project names, phonetic variants, alias conflicts, ambiguous candidates, and explicit filing confirmation. Fix reproducible defects without introducing paid AI dependencies, and submit a focused PR listing files changed, test output, risks and follow-up tasks. Do not modify the production Supabase schema without review.
