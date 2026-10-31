# TODO

## Now
<!-- What's actively being worked on. Keep this to a few items. -->
- [ ] First real Auto Apply trial against an actual job posting (the work history is now
      restructured). Log findings in `docs/automation-notes.md`, including whether the
      `/render` → disk → upload handoff works. Regenerate any Auto Apply prompt copied before
      2026-10-24, since those use the old `/applications` URL.

## Next
<!-- Planned soon, in priority order. -->
- [ ] Revise polish: skip the undo entry when a response changes nothing (all targets were
      deleted mid-request); fix the `page.tsx` comment that says "the replacement already
      reset it" (true for Generate only because its button hides once a document exists; a
      future "Regenerate" button would leave revise stuck at loading).
- [ ] Give `.claude/agents/qa.md` a `tools:` allowlist (no Edit/Write) so "never edits code"
      isn't prompt-only. Check that the Chrome MCP tools and Skill still load with it.

## Later
<!-- Ideas and deferred scope. It's fine for items to sit here. -->
- [ ] Field-level conflict handling for revise: since bc8469e, mid-request edits elsewhere
      survive, but if the user edits the same text the AI rewrites, the AI's text wins
      (including whole skills groups). Compare against the sent text and skip or flag. Revisit
      only if it bites in practice.
- [ ] A frontend test runner (none exists), starting with `matchesSearch` and the revise
      apply/discard logic, which only have browser-run evidence.
- [ ] Structural editing: add/remove whole entries or sections (leaf add/remove already works).
- [ ] Stable id for `Section.title`. Low priority, since section headings rarely need editing.
- [ ] Generate frontend types from the backend's OpenAPI schema instead of hand-mirroring
      `models.py` in `types.ts`. This has never caused a bug, but nothing prevents drift.
- [ ] Reorder `profile.json` keys on disk to match the UI display order. Only for readability.
- [ ] Revisit `MAX_INPUT_CHARS` / `DAILY_CALL_LIMIT` once real usage patterns are known.

## Done recently
<!-- /wrapup moves finished items here with a date. Keep about the last 10. -->
- [x] Live search on the Saved list (case-insensitive name match; × / "Show all" / Escape
      clear; resets on leaving the tab). Browser-tested via Claude in Chrome: 10/10 passed,
      Live and Demo, no console errors (f1eeece, 2026-10-30)
- [x] `qa` subagent for browser tests (`.claude/agents/qa.md`) (bdd77fb, 2026-10-30)
- [x] Revise responses apply to the latest document, so manual edits made mid-request
      survive; responses for a replaced document are discarded; same fix for Profile
      (bc8469e, 2026-10-30). Browser-tested via Claude in Chrome at bc8469e: 7/7 scenarios passed
      (removal survives + stepwise undo, inline edit, removed target, cover letter, tab switch,
      replaced document, profile), 7 real revise calls
- [x] Doc cleanup: rename added to the README's Saved applications line; stale demo-assets
      "Known gaps" bullet removed from `frontend/STATUS_FRONTEND.md` (2544926, 2026-10-30)
- [x] `pytest -m slow` (PDF export) passes in a normal terminal: 1 passed in 18.19s, run by
      the user at a712a63. The earlier main-session failures were the sandbox (2026-10-30)
- [x] Saved-application timestamps: backend writes explicit UTC (`+00:00`) instead of
      deprecated `utcnow()`; the Saved list reads offset-less timestamps as UTC, so times no
      longer show shifted by the UTC offset (a712a63, 2026-10-30)
- [x] Public demo data updated to the corrected work history, with placeholder email and phone
      (01de781 and later syncs, 2026-10-16 to 2026-10-24). Live on Vercel once deployed;
      deployment not checked by Claude
- [x] Clear errors for Anthropic API failures instead of "Failed to fetch" (044cbb2, 2026-10-24)
- [x] Rename saved applications from the Saved list and the application screens; data folder
      and API renamed to `job_applications` / `/job-applications` (570c669, 2026-10-24)
