# Status

_Last verified: 2026-10-04 at 1621a36 (plus uncommitted config/test-guard fixes)_

The project is feature-complete. The real app runs locally (Next.js + FastAPI + Anthropic
API), and a mocked, frontend-only demo is on Vercel. Next step: the first real Auto Apply
trial against an actual job posting.

## Backend

**State:** FastAPI service with `GET /health`, `GET`/`PUT /profile`, `GET /usage`,
`POST /generate`, `POST /revise`, `POST /render` (docx, plus pdf via LibreOffice), and
`/applications` (create, list, get, update, delete). Generation uses prompt caching. A daily
call cap and an input-length guard are in place. Storage is JSON on disk. `live` tests are
skipped unless `RUN_LIVE=1` is set.

| Check | Result | Evidence |
|---|---|---|
| Tests (default set) | passing | `cd backend && .venv/bin/pytest`: 58 passed, 4 deselected, 14 warnings (1621a36 + RUN_LIVE guard, 2026-10-04) |
| `live` guard | working | `-m live`, `-m ""`, `-o addopts=`, and repo-root runs without `RUN_LIVE=1`: 3 skipped (uncommitted, 2026-10-04) |
| `slow` test (PDF export) | **mixed** | `cd backend && .venv/bin/pytest -m slow`: 1 passed in 16s in the verifier subagent's run, but failed twice in the main session (`test_render_resume_pdf` 500 after ~30s), 2026-10-04 (uncommitted). LibreOffice is installed. Likely the main session's sandbox; unconfirmed |
| `live` tests | **unverified** | Not run: they spend real tokens |

**Known issues:** `datetime.utcnow()` is deprecated in Python 3.13 and used twice in
`app/routes/applications.py` (lines 42, 170; shows up as test warnings). Not broken yet.

## Frontend

**State:** Next.js 16 / React 19 / Tailwind v4 single-page app. Has generate, chat-scoped
revision, and inline editing for resume, cover letter, and profile, plus downloads, saved
applications, and Auto Apply prompt assembly. Demo mode is a build-time flag
(`NEXT_PUBLIC_DEMO_MODE`) that serves static fixtures. Local dev has a runtime Live/Demo
toggle.

| Check | Result | Evidence |
|---|---|---|
| Lint | passing | `npm run lint`: exit 0, no output (c102d0d, 2026-10-04) |
| Type-check | passing | `npx tsc --noEmit`: exit 0 (c102d0d, 2026-10-04) |
| Production build | **unverified** | `npm run build` not run this session |
| Live demo site | **unverified** | Not checked this session |

**Known issues:** none known.

## Auto Apply automation

**State:** The prompt template exists (`frontend/app/lib/autoApplyPrompt.ts`). No real
trial yet, and `docs/AUTOMATION_NOTES.md` has no per-site findings. File handoff (saving the
`/render` output to disk for Chrome's upload tool) is untested.

<!--
Rules for this file:
- Rewrite it to describe the current state. It isn't a log; history lives in git.
- Every "passing" or "works" claim needs evidence from a run, or it's marked unverified.
- Future work goes in TODO.md, and reasons in decisions.md.
-->
