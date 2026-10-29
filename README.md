# AURA

AURA is a voice-first personal intelligence workspace designed for Windows and Android. This repository is in the initial setup stage.

## Design direction

Material 3 Expressive, a calm pastel palette, minimal voice-first home screen, and a prominent voice interaction orb. Information management stays accessible without crowding the home screen.

## Proposed architecture

- Windows and Android clients: Tauri 2, React, TypeScript, with native extensions where necessary.
- Cloud API: Next.js backend deployed via Vercel (project: `aura`).
- Database and authentication: dedicated Supabase `Aura` project, accessed only via approved credentials.
- Offline recording and sync queue: device-local storage; recoverable uploads and conflict handling.
- Voice processing and AI: modular transcription and reasoning providers, selected through a technical proof of concept.
- Backups: independently verifiable encrypted archives and tested restoration before release.

## Project rules

1. Never commit secrets, user recordings, customer data, API keys or service-role credentials.
2. Separate development and production data; require review before applying migrations.
3. Every feature needs implementation, automated/manual testing, and a completed acceptance test.
4. Preserve original recordings and source provenance for AI-generated summaries or decisions.
5. Do not publish personal data or recordings to this public repository.

## Current status

- [x] Product direction and design language selected.
- [x] GitHub repository and Vercel project identified.
- [x] Supabase Aura project detected (account email confirmation pending).
- [ ] Toolchain and application shells initialized.
- [ ] Database migrations reviewed and applied.
- [ ] Windows and Android first builds verified.
- [ ] Voice capture, sync and backup acceptance tests completed.

Detailed working checklist: AURA Master Project Map in Google Drive.
