# TODO

## Now
<!-- What's actively being worked on. Keep this to a few items. -->
- [ ] Restructure the work-history data in `backend/app/data/profile.json` before live Auto
      Apply testing with real applications. Draw new bullets from the portfolio case studies
      (`~/Dev/portfolio-website`, e.g. `src/data/projects.ts` and
      `docs/portfolio-handoff/*/entry.md`), and revise exaggerated claims so every bullet is
      accurate and defensible.
- [ ] First real Auto Apply trial against an actual job posting, once the work history is
      restructured. Log findings in `docs/automation-notes.md`, including whether the
      `/render` → disk → upload handoff works.

## Next
<!-- Planned soon, in priority order. -->
- [ ] Confirm `pytest -m slow` (PDF export) passes in a normal terminal. On 2026-10-04 it
      passed in both verifier-subagent runs and failed (500) in both main-session runs,
      probably a sandbox limit.
- [ ] Replace deprecated `datetime.utcnow()` (2 uses in `backend/app/routes/applications.py`)
      with `datetime.now(timezone.utc)` (the file imports the `datetime` class, so
      `datetime.UTC` won't work).
- [ ] Remove the stale "Known gaps" bullet in `frontend/STATUS_FRONTEND.md` about
      `docs/architecture.md` listing `public/demo/*` assets. That was already fixed in ce76b6d.

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
- [x] Point `README.md`, `docs/architecture.md`, `automation-notes.md`, the startup commands, and
      `frontend/STATUS_FRONTEND.md` at `docs/`. Removed root `STATUS.md`/`TODO.md` (2026-10-04)
- [x] Project setup: state docs, root/backend/frontend `CLAUDE.md`, worker and auto-apply
      agents, permission rules (61d6ec9, 1621a36, 2026-10-04)
- [x] `RUN_LIVE=1` guard so live tests can't run by accident; verifier findings on roles and
      doc facts fixed (85d5905, 2026-10-04)
- [x] Moved `architecture.md` and `automation-notes.md` into `docs/` and switched all `docs/`
      names to lowercase, here and in the global config (6553aa6, 06fbbac, 2026-10-04)
