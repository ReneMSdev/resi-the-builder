# Resume Builder

Personal tool that tailors a resume and cover letter to a job description using Claude.
You can revise them through chat or edit them inline, then export to `.docx`/`.pdf`.
Feature-complete. The real app runs locally only. A mocked, frontend-only portfolio demo
is on Vercel (`resi-the-builder.vercel.app`).

## Layout

- `backend/`: FastAPI service (Python 3.13). Has its own `CLAUDE.md`.
- `frontend/`: Next.js 16 app, used for both the real app and the demo build. Has its own `CLAUDE.md`.
- `docs/architecture.md`: current-state reference for both deployment topologies.
- `docs/automation-notes.md`: Auto Apply (Claude-in-Chrome) findings log and hard constraints.
- `backend/CLAUDE_CODE_CONTEXT.md`: original spec. Background only, not current state.
- `backend/STATUS_BACKEND.md`, `frontend/STATUS_FRONTEND.md`: per-side detail,
  written by the worker sessions. The project-wide summary lives in `docs/status.md`.
- `.claude/commands/`: `/manager-startup` and `/automation-startup` role prompts.

## Roles

- **Feature work** (spans both sides, or is substantial): a manager window runs
  `/manager-startup` at the repo root. Workers are background agents by default
  (`.claude/agents/backend.md`, `frontend.md`). Open a window in `backend/` or `frontend/` to
  control a side yourself; the manager checks for windows first. Workers update their
  `STATUS_<side>.md`. The manager owns `docs/`, makes commits, and asks the user to run `/wrapup`.
- **Minor edits** (copy, styling, small fixes): one plain session at the repo root, with no
  startup command. Check only the side you touched; the user runs `/wrapup` at the end.
  Skip `STATUS_BACKEND.md`, but fix `STATUS_FRONTEND.md` if a behavior it describes changed.
- **Auto Apply**: `/automation-startup` or the `auto-apply` agent.

## Commands

| Purpose | Command |
|---|---|
| Backend install | `cd backend && python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt` |
| Backend run | `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000` |
| Backend test | `cd backend && .venv/bin/pytest` (always from `backend/`; excludes `live` and `slow`) |
| Frontend install | `cd frontend && npm install` |
| Frontend run | `cd frontend && npm run dev` (needs `.env.local` with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`) |
| Frontend lint | `cd frontend && npm run lint` |
| Frontend type-check | `cd frontend && npx tsc --noEmit` |
| Frontend build | `cd frontend && npm run build` |

## Project rules

- **Auto Apply never submits an application.** Filling fields and attaching files only;
  clicking Submit/Apply is always a human action. This rule can't be overridden.
- Don't run live tests (`RUN_LIVE=1 ... -m live`, real Anthropic tokens) unless the user asks.
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

Current state: `docs/status.md`. Backlog: `docs/todo.md`. Decisions: `docs/decisions.md`.
