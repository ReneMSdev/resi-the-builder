# Status

_Last verified: 2026-10-24 at 570c669_

The project is feature-complete. The real app runs locally (Next.js + FastAPI + Anthropic
API), and a mocked, frontend-only demo is on Vercel. The work history in `profile.json` was
restructured and checked claim by claim (`docs/work-history-review.md`). Next step: the
first real Auto Apply trial against an actual job posting.

## Backend

**State:** FastAPI service with `GET /health`, `GET`/`PUT /profile`, `GET /usage`,
`POST /generate`, `POST /revise`, `POST /render` (docx, plus pdf via LibreOffice), and
`/job-applications` (create, list, get, update, rename, delete). Saved data lives in
`app/data/job_applications/` (gitignored). Generation uses prompt caching: measured on real
calls, input-token cost was 48% lower across a 4-call session (2026-10-16). A daily call cap
and an input-length guard are in place. Anthropic API failures (bad or missing key, rate
limit, timeout) return readable 502/429/504 errors instead of a CORS-less 500. Application
names are trimmed and limited to 120 characters. `live` tests are skipped unless
`RUN_LIVE=1` is set.

| Check | Result | Evidence |
|---|---|---|
| Tests (default set) | passing | `cd backend && .venv/bin/pytest`: 75 passed, 4 deselected, 19 warnings (570c669, 2026-10-24) |
| `live` guard | working | `env -u RUN_LIVE .venv/bin/pytest -m live`: 3 skipped, 76 deselected (570c669, 2026-10-24) |
| `slow` test (PDF export) | **mixed** | Not run this session. On 2026-10-04 it passed in both verifier-subagent runs and failed (500 after ~30s) in both main-session runs; LibreOffice is installed. Likely the main session's sandbox; unconfirmed until run in a normal terminal |
| `live` tests | **unverified** | Not run: they spend real tokens |

**Known issues:** `datetime.utcnow()` is deprecated in Python 3.13 and used twice in
`app/routes/applications.py` (lines 53, 181; shows up as test warnings). Not broken yet.

## Frontend

**State:** Next.js 16 / React 19 / Tailwind v4 single-page app. Has generate, chat-scoped
revision, and inline editing for resume, cover letter, and profile, plus downloads, saved
applications (with rename from the Saved list or the application title), and Auto Apply
prompt assembly. Backend errors show their `detail` message. Demo mode is a build-time flag
(`NEXT_PUBLIC_DEMO_MODE`) that serves static fixtures; the fixtures match the current profile
with placeholder email and phone. Local dev has a runtime Live/Demo toggle.

| Check | Result | Evidence |
|---|---|---|
| Lint | passing | `npm run lint`: exit 0 (570c669, 2026-10-24) |
| Type-check | passing | `npx tsc --noEmit`: exit 0 (570c669, 2026-10-24) |
| Production build | passing | `npm run build`: "Compiled successfully" (570c669, 2026-10-24) |
| Live demo site | **unverified** | Not checked by Claude; the user checks it. Which branch Vercel deploys from is unconfirmed |

**Known issues:** none known.

## Auto Apply automation

**State:** The prompt template exists (`frontend/app/lib/autoApplyPrompt.ts`) and points at
the renamed data folder and `/job-applications` URL. Prompts copied before 2026-10-24 use the
old URL and should be regenerated. No real trial yet, and `docs/automation-notes.md` has no
per-site findings. File handoff (saving the `/render` output to disk for Chrome's upload
tool) is untested.

<!--
Rules for this file:
- Rewrite it to describe the current state. It isn't a log; history lives in git.
- Every "passing" or "works" claim needs evidence from a run, or it's marked unverified.
- Future work goes in todo.md, and reasons in decisions.md.
-->
