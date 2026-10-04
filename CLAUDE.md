# Resume Builder

Personal tool that tailors a resume and cover letter to a job description using Claude.
You can revise them through chat or edit them inline, then export to `.docx`/`.pdf`.
Feature-complete. The real app runs locally only. A mocked, frontend-only portfolio demo
is on Vercel (`resi-the-builder.vercel.app`).

## Layout

- `backend/`: FastAPI service (Python 3.13). Has its own `CLAUDE.md`.
- `frontend/`: Next.js 16 app, used for both the real app and the demo build. Has its own `CLAUDE.md`.
- `ARCHITECTURE.md`: current-state reference for both deployment topologies.
- `AUTOMATION_NOTES.md`: Auto Apply (Claude-in-Chrome) findings log and hard constraints.
- `backend/CLAUDE_CODE_CONTEXT.md`: original spec. Background only, not current state.
- `backend/STATUS_BACKEND.md`, `frontend/STATUS_FRONTEND.md`: historical build logs and
  implementation detail. Current state lives in `docs/STATUS.md`.
- `.claude/commands/`: `/manager-startup` and `/automation-startup` role prompts.

## Commands

| Purpose | Command |
|---|---|
| Backend install | `cd backend && python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt` |
| Backend run | `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000` |
| Backend test | `cd backend && .venv/bin/pytest` (excludes `live` and `slow`) |
| Frontend install | `cd frontend && npm install` |
| Frontend run | `cd frontend && npm run dev` (needs `.env.local` with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`) |
| Frontend lint | `cd frontend && npm run lint` |
| Frontend type-check | `cd frontend && npx tsc --noEmit` |
| Frontend build | `cd frontend && npm run build` |

## Project rules

- **Auto Apply never submits an application.** Filling fields and attaching files only;
  clicking Submit/Apply is always a human action. This rule can't be overridden.
- Don't run `pytest -m live` (it spends real Anthropic tokens) unless the user asks.
- `backend/app/data/profile.json` is the user's real master profile, tracked on purpose.
  `backend/app/data/applications/` is gitignored user data. Don't commit it.
- `NEXT_PUBLIC_DEMO_MODE=true` is set only in Vercel's project settings, never locally.
  Preview demo mode locally with the Live/Demo toggle instead.
- `frontend/app/types.ts` mirrors `backend/app/models.py` by hand. Change both together.
- Frontend and backend sessions may share this working directory, so commit with explicit
  pathspecs.
- The user tests UI changes themselves. Prefer lint, `tsc`, curl, and reading the code over
  Claude-in-Chrome checks. Save the browser for risky async or visual changes.

## State

Current state: `docs/STATUS.md`. Backlog: `docs/TODO.md`. Decisions: `docs/decisions.md`.
