# TODO

## Now
<!-- What's actively being worked on. Keep this to a few items. -->
- [ ] First real Auto Apply trial against an actual job posting (the work history is now
      restructured). Log findings in `docs/automation-notes.md`, including whether the
      `/render` → disk → upload handoff works. Regenerate any Auto Apply prompt copied before
      2026-10-24, since those use the old `/applications` URL.

## Next
<!-- Planned soon, in priority order. -->
- [ ] Confirm `pytest -m slow` (PDF export) passes in a normal terminal. On 2026-10-04 it
      passed in both verifier-subagent runs and failed (500) in both main-session runs,
      probably a sandbox limit.
- [ ] Replace deprecated `datetime.utcnow()` (2 uses in `backend/app/routes/applications.py`)
      with `datetime.now(timezone.utc)` (the file imports the `datetime` class, so
      `datetime.UTC` won't work).
- [ ] Add rename to the Saved applications line in `README.md` ("save, reload, and update").
- [ ] Remove the stale "Known gaps" bullet in `frontend/STATUS_FRONTEND.md` about
      `docs/architecture.md` listing `public/demo/*` assets. That was already fixed in ce76b6d.

- [ ] A manual edit or remove made while an AI revise is still running is overwritten when
      the response arrives (`handleRevise` applies its result to the document captured at
      request time). Pre-existing, but removals make it easier to hit. Apply the response to
      the latest document instead, or disable editing while a revise runs.

## Later
<!-- Ideas and deferred scope. It's fine for items to sit here. -->
- [ ] Manual-edit protection during chat revision (a "manually edited" provenance flag).
      Revisit only if hand edits actually get overwritten in practice.
- [ ] Structural editing: add/remove whole entries or sections (leaf add/remove already works).
- [ ] Stable id for `Section.title`. Low priority, since section headings rarely need editing.
- [ ] Generate frontend types from the backend's OpenAPI schema instead of hand-mirroring
      `models.py` in `types.ts`. This has never caused a bug, but nothing prevents drift.
- [ ] Reorder `profile.json` keys on disk to match the UI display order. Only for readability.
- [ ] Revisit `MAX_INPUT_CHARS` / `DAILY_CALL_LIMIT` once real usage patterns are known.

## Done recently
<!-- /wrapup moves finished items here with a date. Keep about the last 10. -->
- [x] Moved `architecture.md` and `automation-notes.md` into `docs/` and switched all `docs/`
      names to lowercase, here and in the global config (6553aa6, 06fbbac, 2026-10-04)
- [x] Work-history review: per-project claim checks and measurements logged in
      `docs/work-history-review.md` (3b3c02e, 5832b24, 2026-10-07)
- [x] Restructured `profile.json`: unsupported claims removed, accurate bullets from the code
      and case studies, Founder & Software Engineer title, LinkLeaf Projects entry, frontend-only
      freelance role (ed03b40, be7b22f, 1db93de, 2026-10-07 to 2026-10-17)
- [x] Resume Builder entry (first in Projects) and AI skills group; prompt caching measured on
      real calls: 48% lower input-token cost over a 4-call session (d064cc7, 2026-10-16)
- [x] Summary pool rebuilt around 7 target roles, "5+ years" corrected (be7b22f, 2026-10-17)
- [x] Public demo data updated to the corrected work history, with placeholder email and phone
      (01de781 and later syncs, 2026-10-16 to 2026-10-24). Live on Vercel once deployed;
      deployment not checked by Claude
- [x] Clear errors for Anthropic API failures instead of "Failed to fetch" (044cbb2, 2026-10-24)
- [x] Rename saved applications from the Saved list and the application screens; data folder
      and API renamed to `job_applications` / `/job-applications` (570c669, 2026-10-24)
