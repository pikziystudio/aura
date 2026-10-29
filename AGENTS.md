# AURA Development Rules

- Source of truth: AURA project checklist in Google Drive.
- Visual direction: Material 3 Expressive, calm, light pastel surfaces, voice-first, intentionally minimal home. Do not build a crowded dashboard.
- Native targets: Tauri 2 for Windows and Android; the Next.js web app is an early design and cloud-shell foundation, not the final native application.
- Database isolation: ONLY the dedicated Supabase Aura project `rwivnjxlmjctjdbxlfxf`; never connect to or modify PikZiy Books.
- No database changes without a versioned migration file, review, and verification.
- Do not commit personal data, recordings, credentials, or service-role keys.
- Capture and backup: offline durability, source provenance, encryption and verified restore are release blockers.
- Never claim a feature is functioning based on a visual mockup alone.
