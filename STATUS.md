# Resume Builder — Global Status

_Last updated: 2026-09-16_

High-level status for the whole monorepo. For implementation detail, see:
- [`backend/STATUS_BACKEND.md`](backend/STATUS_BACKEND.md) — FastAPI service
- [`frontend/STATUS_FRONTEND.md`](frontend/STATUS_FRONTEND.md) — Next.js app

## What this project is

Personal tool to speed up job applications. Paste a job description → backend calls
Claude to tailor a resume (or cover letter) from a master profile → user edits pieces
via chat-scoped revision → downloads a formatted `.docx`/`.pdf`. See
`backend/CLAUDE_CODE_CONTEXT.md` for the original spec/architecture doc.

## In progress: UI/storage redesign (branch `redesign/application-workspace`)

Not yet merged to `main`. Reworking the frontend into a two-bar flat layout (top bar:
logo/backend-status/"generate for new job"; second bar: Job Description/Resume/Cover
Letter/Saved as flat peer tabs) and introducing a job-application "package" concept on
the backend (bundling JD + resume + cover letter together, replacing today's
one-document-at-a-time `/resumes` save). See `TODO.md`'s "Planned features" section for
the full design and phase breakdown. Backend's `cleaned_job_description` field
(Phase 1) and the frontend's new layout (Phase 2) are done and verified; the backend
`/applications` package storage (Phase 3) and the Saved-tab/Save-button rework that
depends on it are not started yet.

## Overall state (on `main`): feature-complete, running locally only

Both halves of the original plan are done and verified end-to-end together:

- **Backend** (`/backend`, FastAPI + Anthropic): `/health`, `/profile`, `/usage`,
  `/generate`, `/revise`, `/render` all support both resumes and cover letters, with
  daily-call and input-length guardrails in place. No open gaps.
- **Frontend** (`/frontend`, Next.js): connectivity check, generate view, styled
  preview with 3-level selection (bullet/entry/section), chat-scoped revision, cover
  letter mode, and docx/pdf download — all 6 planned phases complete for both resumes
  and cover letters. No open gaps.

## Not yet built

- **Cloudflare Tunnel** — stable hostname to expose the local backend so a
  Vercel-hosted frontend can reach it. Not started.
- **Vercel deployment** of the frontend, dependent on the tunnel above.

Everything else in the original plan is complete — remaining work is deployment
infrastructure, not features.

## Environment quick-reference

- Backend: `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`
  (Python 3.13, see `backend/STATUS_BACKEND.md` for the venv-corruption gotcha).
- Frontend: `cd frontend && npm run dev` (needs `frontend/.env.local` with
  `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`).
- Both run locally only for now; CORS on the backend is wide open (`*`) until a real
  deployed frontend origin exists to lock it down to.
