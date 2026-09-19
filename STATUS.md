# Resume Builder — Global Status

_Last updated: 2026-09-18_

High-level status for the whole monorepo. For implementation detail, see:
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the two deployment topologies (local
  full-stack vs. the Vercel demo) and the file/component map for each
- [`backend/STATUS_BACKEND.md`](backend/STATUS_BACKEND.md) — FastAPI service
- [`frontend/STATUS_FRONTEND.md`](frontend/STATUS_FRONTEND.md) — Next.js app
- [`TODO.md`](TODO.md) — backlog, deferred scope, known soft spots
- [`AUTOMATION_NOTES.md`](AUTOMATION_NOTES.md) — Claude-in-Chrome job-application
  automation findings log

## What this project is

Personal tool to speed up job applications. Paste a job description → backend calls
Claude to tailor a resume and/or cover letter from a master profile → user edits pieces
via chat-scoped revision or inline manual editing → downloads a formatted `.docx`/
`.pdf`, or saves the whole job-application package for later. The master profile itself
is editable the same way (chat-revise + manual edit + explicit "Apply to Profile" write
step). See `backend/CLAUDE_CODE_CONTEXT.md` for the original spec — background/rationale
only, not current state.

## Current state: feature-complete, two deployments

**Real app** (local full-stack — Next.js + FastAPI + Anthropic API, run together by the
user): generate/revise/download for both resumes and cover letters, profile editing,
job-application package save/load/update (`/applications`), and Auto Apply (assembles a
Claude-in-Chrome automation prompt from a saved package — fill-only, **never
auto-submit**). No open feature gaps beyond `TODO.md`'s small backlog items.

**Public demo** (`resi-the-builder.vercel.app`) — frontend-only, zero backend
dependency, mocked data, $0 to host, no API key anywhere near the client. A portfolio
showcase, not a path to the real app. See `ARCHITECTURE.md` for how the two share one
frontend codebase via a build-time flag.

## Branches

Only `main` and `working`, currently in sync. Feature branches get deleted once merged
(`redesign/application-workspace` and `profile-editing` were both cleaned up this way).

## Not yet started / decided against

- No stable hostname for the real backend (a Cloudflare Tunnel was considered) —
  **decided against**, not just deferred: the Auto Apply automation workflow already
  requires the project open locally, so there's no scenario needing the real backend
  reachable from elsewhere.
- First real end-to-end Auto Apply trial against an actual job posting — not yet run;
  `AUTOMATION_NOTES.md` is set up and waiting for it.

## Environment quick-reference

- Backend: `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`
  (Python 3.13, see `backend/STATUS_BACKEND.md` for the venv-corruption gotcha).
- Frontend (real app): `cd frontend && npm run dev` (needs `frontend/.env.local` with
  `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`). Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`)
  is only ever set in Vercel's project settings, never locally — a local dev server can
  still preview it at runtime via the bottom-right Live/Demo toggle without a rebuild.
- The real app runs locally only, by design (see "Not yet started" above); CORS is
  wide open (`*`) indefinitely for the same reason — no real deployed frontend origin
  is planned to lock it down to.
