# Status

_Last verified: 2026-10-30 at bdd77fb_

The project is feature-complete. The real app runs locally (Next.js + FastAPI + Anthropic
API), and a mocked, frontend-only demo is on Vercel. The work history in `profile.json` was
restructured and checked claim by claim (`docs/work-history-review.md`). The first real
Auto Apply trial is on hold (moved to Later in `docs/todo.md` on 2026-10-30).

## Backend

**State:** FastAPI service with `GET /health`, `GET`/`PUT /profile`, `GET /usage`,
`POST /generate`, `POST /revise`, `POST /render` (docx, plus pdf via LibreOffice), and
`/job-applications` (create, list, get, update, rename, delete). Saved data lives in
`app/data/job_applications/` (gitignored). New `created_at`/`updated_at` values are explicit
UTC (`+00:00`); older saved files keep offset-less UTC strings and still parse and sort
correctly. `/revise` returns text updates plus validated removals, additions (new or split
bullets and paragraphs, anchored to existing ids) and a whole-section `skills_replace`, and
rejects shifted or invented ids. An empty selection means the whole document. After
generation, certifications and education are sorted newest first. The cover letter's contact
line includes LinkedIn and website. Generation uses prompt caching: measured on real calls,
input-token cost was 48% lower across a 4-call session (2026-10-16). A daily call cap and an
input-length guard are in place. Anthropic API failures (bad or missing key, rate limit,
timeout) return readable 502/429/504 errors instead of a CORS-less 500. Application names are
trimmed and limited to 120 characters. `live` tests are skipped unless `RUN_LIVE=1` is set.

| Check | Result | Evidence |
|---|---|---|
| Tests (default set) | passing | `cd backend && .venv/bin/pytest -q`: 125 passed, 4 deselected, 1 warning (starlette/anyio deprecation, unrelated) (bdd77fb, 2026-10-30) |
| `live` guard | working | `env -u RUN_LIVE .venv/bin/pytest -m live -q`: 3 skipped, 126 deselected (bdd77fb, 2026-10-30) |
| `slow` test (PDF export) | passing | `.venv/bin/pytest -m slow` in the user's terminal: 1 passed, 128 deselected, 1 warning in 18.19s (a712a63, 2026-10-30). Earlier main-session failures (2026-10-04) were the Claude sandbox |
| Prompt caching (real API) | working | 2 real `generate` calls with the current API key and profile (3fb114a, 2026-10-25, $0.15): the resume call wrote 11,961 tokens to the cache; the cover letter for the same job read 10,511 of its 12,975 prompt tokens (81%) from it. Input cost 24% lower than uncached over the 2 calls (48% over 4 calls on 2026-10-16) |
| Revise removals / whole-document (real API) | working | 4 real `/revise` calls on a saved resume (2026-10-24, $0.13): no removals on a reword-only whole-resume request; exactly the two technician entries removed when asked; a single-bullet request touched only that bullet; a section-scoped removal stayed inside the section. Split request (2026-10-25, $0.03): the bullet was updated with the first part and the second part added right after it; no other bullets touched |
| `live` tests | **unverified** | Not run: they spend real tokens |

**Known issues:** none known. (The default application name, used when there's no company
or role, shows UTC time; accepted, see `docs/decisions.md`.)

## Frontend

**State:** Next.js 16 / React 19 / Tailwind v4 single-page app. Has generate, chat-scoped
revision, and inline editing for resume, cover letter, and profile, plus downloads, saved
applications, and Auto Apply prompt assembly.
- **Revise:** can add, split, remove, and restructure skills, and revises the whole document
  when nothing is selected. A response is applied to the document as it is when it arrives,
  so edits made while a revise runs survive and one undo reverts only the AI change.
  Responses for a document replaced mid-request (Generate, loading a saved application,
  Generate for new job) are discarded. Profile revise works the same way.
- **Editing:** removing sections, entries, and paragraphs. Switching to Edit mode clears
  selections.
- **Saved applications:** save, reload, update (also Cmd/Ctrl+S), and rename from the Saved
  list or the application title. A live search box filters the list by name (× / "Show all"
  / Escape to clear; resets when leaving the tab). Times show in local time, including older
  saves with offset-less timestamps.
- **Copy:** copy-as-text on the resume and cover-letter previews and the job description
  reference view.

Backend errors show their `detail` message. Demo mode is a build-time flag
(`NEXT_PUBLIC_DEMO_MODE`) that serves static fixtures; the fixtures match the current profile
with placeholder email and phone. Local dev has a runtime Live/Demo toggle.

| Check | Result | Evidence |
|---|---|---|
| Lint | passing | `npm run lint`: exit 0 (bdd77fb, 2026-10-30) |
| Type-check | passing | `npx tsc --noEmit`: exit 0 (bdd77fb, 2026-10-30) |
| Production build | passing | `npm run build`: exit 0, "Compiled successfully" (bdd77fb, 2026-10-30) |
| Revise applies to latest document (browser) | working | Claude-in-Chrome run, not a user test: 7/7 scenarios passed (removal survives + stepwise undo, inline edit, removed target, cover letter, tab switch, replaced document, profile), 7 real revise calls (bc8469e, 2026-10-30) |
| Saved search (browser) | working | Claude-in-Chrome run, not a user test: 10/10 passed in Live and Demo, no console errors (f1eeece code, 2026-10-30) |
| Saved-list times (browser) | working | Checked by the user after the UTC fix (a712a63, 2026-10-30) |
| Live demo site | **unverified** | Not checked by Claude. `main` was fast-forwarded to bdd77fb on 2026-10-30; whether Vercel deploys from `main` and shows today's changes is unconfirmed |

**Known issues:** none known. The frontend has no test runner, so the revise race logic and
`matchesSearch` have no automated tests; the browser runs above are the evidence.

## Auto Apply automation

**State:** The prompt template exists (`frontend/app/lib/autoApplyPrompt.ts`) and points at
the renamed data folder and `/job-applications` URL. Prompts copied before 2026-10-24 use the
old URL and should be regenerated. No real trial yet, and `docs/automation-notes.md` has no
per-site findings. File handoff (saving the `/render` output to disk for Chrome's upload
tool) is untested.

## Tooling

Browser tests go to the `qa` subagent (`.claude/agents/qa.md`), only when the user asks or
agrees. Its safety rules (no Save/Apply/Generate, revise cap, only the "Justworks — Testing
application" item may be renamed or deleted) are prompt-only; its frontmatter has no `tools:`
allowlist.

<!--
Rules for this file:
- Rewrite it to describe the current state. It isn't a log; history lives in git.
- Every "passing" or "works" claim needs evidence from a run, or it's marked unverified.
- Future work goes in todo.md, and reasons in decisions.md.
-->
