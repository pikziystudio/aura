# AURA

**A private, voice-first personal intelligence and memory workspace.** AURA captures ideas, conversations and tasks, preserves original audio, transcribes locally, and helps you review and file memories against existing projects.

> **Current stage:** working Next.js/Supabase browser prototype, **not** a finished Windows/Android assistant or production-safe offline recorder.

## Start here (including Codex)

1. Read [Product & Architecture](docs/PRODUCT_AND_ARCHITECTURE.md) for the full vision, design principles, architecture, data model and limitations.
2. Read [Engineering Roadmap & Release Gates](docs/ROADMAP.md) for completed scope, remaining work, acceptance tests and the **first Codex task**.
3. Follow [AGENTS.md](AGENTS.md) for mandatory implementation, security, testing and deployment rules.
4. Inspect the actual code and migrations. Documentation is a handoff, not evidence of passed tests.

## Local web development

Use a recent Node.js LTS installation, then:

```bash
npm install
cp .env.example .env.local
npm run dev
npm run typecheck
npm run build
```

On Windows PowerShell, copy the example file with `Copy-Item .env.example .env.local`.

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the **dedicated AURA** Supabase project. Never commit real keys, audio or private user information.

## Working prototype features
- Supabase Auth, personal workspace, project and note management.
- Browser recording stored in a private Supabase Storage bucket, secure playback.
- Open-source browser Whisper local transcription (Base and Small) and saved raw transcript.
- Separate human transcript corrections.
- Suggested title and project matching with a user confirmation step, filing decisions and confirmed project aliases.

**Known limitations:** model downloads can be slow/repeated; matching is imperfect and initially rule-based; title generation is basic; recording can be lost if the browser closes before upload; filing updates need transaction hardening; no native release, automated end-to-end test suite or verified restore/backup process.

## Deployment and infrastructure
- Web: https://aura-pik-ziy-books.vercel.app
- GitHub: https://github.com/pikziystudio/aura
- Supabase: AURA project `rwivnjxlmjctjdbxlfxf` (not PikZiy Books).
- Existing main branch pushes may trigger Vercel deployments. Confirm the latest deployment is **READY** before reporting features live.
- Local transcription does **not** require OpenAI API billing. An old server-side endpoint may remain until cleanup and security review.

## Future targets
Native Windows and Android clients, resilient/offline recording, reliable sync, private local-first reasoning, reviewed task and project automation, encrypted backups and verified recovery.

**Status and next steps:** [docs/ROADMAP.md](docs/ROADMAP.md). 
