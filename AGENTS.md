# AURA — Instructions for Codex and AI Coding Agents

**First read:** [docs/PRODUCT_AND_ARCHITECTURE.md](docs/PRODUCT_AND_ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md). These are the maintained handoff and implementation checklist. The Google Drive AURA Master Project Map is the high-level product planning companion; current repo code and database remain authoritative for actual implementation.

## Product invariants
- AURA is **voice-first, private, minimal**, Material 3 Expressive-inspired, with pastel surfaces and a central orb. Avoid crowded dashboards.
- Long-term native goal is Windows + Android (Tauri 2 candidate); current Next.js app is the web prototype, not native release.
- Record first, organize afterward. Never require a project or title to begin recording.
- Protect provenance: original audio != raw transcription != human correction != machine suggestion != approved filing.
- AI should **suggest** associations, project names and tasks, not silently create or misfile them. Ambiguity goes to Inbox pending review.
- Prefer free local open-source models; never assume a paid OpenAI transcription API is required.

## Security and data
- **ONLY** use dedicated AURA Supabase project `rwivnjxlmjctjdbxlfxf`; NEVER read/write PikZiy Books.
- Preserve and test Supabase RLS for all user-owned resources, including storage, aliases and decision history.
- Never commit secrets, service-role credentials, actual personal recordings, client/user data or production exports. The GitHub repo is currently public.
- All schema changes require versioned SQL migration, review, rollback plan, applied-version reconciliation and verification. Do not rerun historical migrations blindly.
- No public access to private storage or unrestricted `SECURITY DEFINER` RPC endpoints.
- Local transcription does not make recordings automatically private once they are explicitly uploaded to Supabase; communicate privacy precisely.

## Workflow
1. Read current repository state, run dependency install, `npm run typecheck`, `npm run build`, and existing test suites before modifying behavior.
2. Work in focused branches/PRs when possible; don't push half-built behavior straight to production.
3. Add regression tests for every bug, especially pronunciation, CamelCase names, aliases, authorization and filing consistency.
4. Verify actual schema, permissions and deployment status rather than assuming documentation is current.
5. Separate implemented/tested features from planned work and prototypes.
6. At delivery: list **every updated file**, tests run/results, migration details, deployment/PR link, unresolved risks and next step.
7. Do not invent user confirmations, project matches, transcript content, test results or deployment status.

## Immediate priority
Follow **P0** and **P1** in [docs/ROADMAP.md](docs/ROADMAP.md). Focus on reproducible tests, reliability, project matching and explicit confirmation before adding sophisticated AI features.

## Hard release blockers
Crash-safe offline recording, verified recovery/sync, negative RLS security tests, encrypted backups with restore testing, and Windows/Android acceptance. Do not declare production-ready without evidence.
