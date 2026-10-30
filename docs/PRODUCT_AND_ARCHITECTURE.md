# AURA — Product and Architecture Brief

**Last reviewed:** 2026-10-30  
**Audience:** Codex, maintainers, product/design reviewers  
**Status:** Working prototype; NOT a production-ready personal memory system

## 1. Product mission

AURA is a **private, voice-first personal intelligence and memory workspace** for the founder and selected invited users. Capture thoughts, meetings, projects, tasks and ideas in natural speech (including Hindi, English and Hinglish); preserve the source audio; transcribe locally when practical; organize memories against verified projects/people; and eventually help retrieve, summarize and act on knowledge.

It should feel like a quiet personal assistant, **not** an accounting app, CRM, generic dashboard, or a clone of ChatGPT.

### Experience principles
- Voice orb is the visual and interaction focal point; home stays calm, airy and minimal.
- Material 3 Expressive-inspired direction: soft pastels, restrained gradients, responsive, readable, accessible.
- Separate dedicated pages for **My Memory** and **Projects**; future Ideas, Tasks, Search and settings.
- Windows (.exe/.msi) and Android (.apk) are product targets. The current Next.js site is a web prototype/cloud shell, **not** a native release.
- Voice-first means low-friction recording and later organization. Avoid making users type titles or pick projects before recording.
- User trust over automation: clearly separate **raw source**, **AI suggestion**, **human correction**, and **confirmed decision**.
- Cost sensitivity: favor local open-source models and free-tier infrastructure, while explicitly acknowledging storage/hosting usage costs.

## 2. Fixed decisions and resources
- Repository: https://github.com/pikziystudio/aura (currently public; absolutely no personal content or secrets in commits).
- Web preview: https://aura-pik-ziy-books.vercel.app (Vercel project `aura`; existing production alias may differ).
- Dedicated Supabase project ID `rwivnjxlmjctjdbxlfxf`, region Tokyo. **Never touch the separate PikZiy Books Supabase project.**
- Google Drive master planning document: https://docs.google.com/document/d/1n4a5mThkDvrrrDI7USUDs7wDD8mSIKGJxKAhahxpz-M/edit
- Drive working folder: https://drive.google.com/drive/folders/14QVCjrJD1NT_cc9ysjrHGRUaTYz81037
- Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. OpenAI server transcription variables are legacy and should be removed after verifying local replacement, not depended on.
- Private Supabase Storage bucket `aura-recordings`, with owner-prefix policies and MIME/size constraints.
- Auth: Supabase email/password, personal workspace, invite-only intent. Google sign-in and MFA are future work.
- Tech now: Next.js 15, React 19, TypeScript, Supabase JS 2, lucide-react, browser-whisper 2.
- Native direction (not implemented): Tauri 2 + React/TypeScript with platform-specific audio, storage and speech modules. Reassess feasibility before committing architecture.
- Browser transcription: open-source `browser-whisper` with `whisper-base` and `whisper-small`. Tested one successful English transcript, and Small produced better proper-name recognition, but not perfect.
- Do not imply a paid OpenAI API is required for local Whisper; it is not. Local Whisper first run downloads model weights and may take substantial time.
- Security: user data is private. Preserve RLS and never put privileged Supabase or AI keys in the browser.

## 3. Current data model

The schema is source-controlled in `supabase/migrations/`. Historic initial migration and applied migration versions should be reconciled carefully; **do not blindly rerun migrations**.

- `workspaces`: owner-scoped personal workspaces.
- `projects`: owner-scoped projects, name, status, description.
- `captures`: notes/recordings, private audio path, raw transcript, corrected transcript, title, project ID, processing status, filing status, suggested title/project fields.
- `tasks`: early schema only; functional task workflow not built.
- `project_aliases`: user-confirmed alternative project spellings/names.
- `filing_decisions`: user-scoped filing decision history; transactional consistency to be improved.
- Storage: original recording in private `aura-recordings` bucket. Access via authenticated session or short-lived signed URL.

The actual database/schema and access policies should be inspected before modifications. Never hardcode user IDs or create aliases from private content in the repository.

## 4. Implemented vs not implemented

**Implemented in prototype (some manual acceptance tests):**
- Auth gate, password sign-in/reset and personal workspace bootstrap.
- Project create/list/archive; note create/list/search; manually assign project.
- Browser MediaRecorder capture, Supabase private storage upload and playback.
- Local browser Whisper transcription and saving `raw_transcript`.
- Editable `corrected_transcript`, preserving raw machine transcript.
- Filing review screen, title suggestion (currently basic first-sentence rule), project select and confirmed filing.
- Project alias creation upon explicit confirmation; matching heuristics for DearMind / Dear Mind / Deer Mind / D-R Mind variants.
- Separate source-code migration for alias and filing schema.

**Partial, fragile, or not yet accepted:**
- Project suggestions: exact/alias/limited name heuristics, not generic semantic intelligence. Matching UI and database aliases need verified end-to-end tests.
- Automatic review after transcription exists, but no reliable cross-view onboarding/auto-navigation.
- Default title remains `Voice note` on capture; suggested title requires review.
- Browser model weights may re-download; check origin, caching, worker lifecycle and OPFS availability; don't promise one-time download without testing.
- No offline crash recovery. Tab close mid-recording can lose audio. No persistent upload queue.
- No verified background jobs, retries, model warm-up, chunked long-audio flow or speech diarization.
- No general AI summaries, extraction of people/tasks or grounded Q&A.
- No robust Android/Windows packages.
- No proven encrypted offsite backup and restoration.
- No verified production security and performance acceptance.

## 5. Current known issues and pitfalls

1. Project name is stored as `DearMind` (CamelCase), while Whisper may hear `Deer Mind`, `Dear Mind`, `DR Mind`, `D-R Mind`, or `your mind`. Matching must work on canonical names, confirmed aliases and contextual suggestions without silently assigning a wrong project.
2. Early matching code contained over-escaped normalization expressions, fixed in later commits. Add regression tests so this cannot recur.
3. Filing review was too narrow inside the memory record, fixed with responsive styles; visually retest.
4. Filing writes `captures` and `filing_decisions` separately; a history failure can leave inconsistent state. Use a secure owner-scoped database function or other atomic workflow.
5. Alias proposals from transcript corrections are intentionally conservative and may miss multiple-edits/reordered speech. Never auto-learn unconfirmed names.
6. Current `voice-capture.tsx` creates object URLs during render; manage and revoke URLs to avoid memory leaks.
7. Current audio browser recording isn't durable before upload. This is a release blocker.
8. Audit existing security advisories: public-schema `vector` extension and a public `SECURITY DEFINER` `rls_auto_enable()` function were previously flagged. Inspect permissions/usage before remediation.
9. Current site and source are public; keep actual recordings and identity data out of PRs, screenshots and test fixtures.
10. Large WebGPU/Whisper models may exceed browser/device limits; handle storage/memory errors gracefully and expose model choice and size.

## 6. Future capabilities (not claims of existing features)

- Realtime or post-recording transcription, Hindi/English/Hinglish tests, user vocabulary and learning from confirmed edits.
- Local or optional self-hosted AI for summaries, extraction of people, project tasks, decision logs and citations linked to audio/transcript.
- Record first, review automatically, confirm project/title/tasks; Inbox for uncertain evidence and full undo history.
- Search across memories with provenance and user-scoped indexing; project-specific context.
- True native Windows + Android voice assistant; offline capture, local speech, sync queue; accessibility and notifications.
- Encrypted backups, versioned exports and regularly tested restore to an independent location.
- Privacy controls, device/session handling, verified permissions and eventual multi-user sharing rules.

## 7. Operational boundaries
- Run `npm install`, `npm run typecheck`, `npm run build` and appropriate tests after modifying code. This project currently lacks a comprehensive test suite; establish one.
- Do not use real client/private recordings in automated tests. Use synthetic fixtures.
- Each milestone should specify scope, schema changes, security posture, acceptance tests and rollback path.
- Verify deployment READY for the correct commit before telling the user that a fix is live.
- Avoid suggesting users pay for API transcription when the local Whisper path can serve the task.
- Always report **which files changed**, what was tested, what remains unverified.
