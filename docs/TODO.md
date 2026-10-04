# TODO

## Now
<!-- What's actively being worked on. Keep this to a few items. -->
- [ ] First real Auto Apply trial against an actual job posting. Log findings in
      `AUTOMATION_NOTES.md`, including whether the `/render` → disk → upload handoff works.

## Next
<!-- Planned soon, in priority order. -->
- [ ] Confirm `pytest -m slow` (PDF export) passes in a normal terminal. It passed once and
      failed twice (500) in Claude sessions on 2026-10-04, probably a sandbox limit.
- [ ] Replace deprecated `datetime.utcnow()` (2 uses in `backend/app/routes/applications.py`)
      with `datetime.now(timezone.utc)` (the file imports the `datetime` class, so
      `datetime.UTC` won't work).
- [ ] Remove the stale "Known gaps" bullet in `frontend/STATUS_FRONTEND.md` about
      `ARCHITECTURE.md` listing `public/demo/*` assets. That was already fixed in ce76b6d.

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
- [x] Point `README.md`, `ARCHITECTURE.md`, `AUTOMATION_NOTES.md`, the startup commands, and
      `frontend/STATUS_FRONTEND.md` at `docs/`. Removed root `STATUS.md`/`TODO.md` (2026-10-04)
