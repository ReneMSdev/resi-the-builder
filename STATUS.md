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

## Complete, not yet merged: UI/storage redesign (branch `redesign/application-workspace`)

All 5 phases done and verified, ready for merge review — not yet merged to `main`.
Reworked the frontend into a two-bar flat layout (top bar: logo/backend-status/
"generate for new job"; second bar: Job Description/Resume/Cover Letter/Saved as flat
peer tabs), plus a top-bar polish round (stone background, Roboto Mono coral logo,
contrast fixes, auto-growing chat input). Introduced a job-application "package"
concept on the backend (`/applications`, replacing `/resumes` entirely) bundling JD +
resume + cover letter together, with the Saved tab and Save button fully wired to it
(per-package pills, one-click load hydrating all three tabs). See
`backend/STATUS_BACKEND.md` ("Backend Part 6"/"Part 7") and
`frontend/STATUS_FRONTEND.md` (the redesign + `/applications`-wiring sections) for full
build/verification detail.

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
