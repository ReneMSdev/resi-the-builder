# Decisions

Append-only log of choices made and why. Newest at the bottom. Don't edit old
entries: if a decision is reversed, add a new entry that references the old one.

<!-- Entry format:

## YYYY-MM-DD: {{Short title}}

**Decision:** {{what was chosen}}
**Alternatives:** {{what else was considered}}
**Why:** {{the reason, including constraints at the time}}

-->

## (imported) Python 3.13 for the backend

**Decision:** Pin the backend venv to Python 3.13.
**Alternatives:** 3.12 (originally requested) and 3.14 (system default).
**Why:** 3.14 had no prebuilt `pydantic-core` wheel and failed to compile from source at
the time. 3.13 worked, so the user asked not to reopen this unprompted. Source:
`backend/STATUS_BACKEND.md`.

## (imported) `anthropic==1.5.0` instead of the spec's 0.39.0

**Decision:** Use `anthropic==1.5.0`.
**Alternatives:** The spec's `0.39.0`.
**Why:** 0.39.0 crashes on import with modern `httpx`, which removed the `proxies` kwarg.
Source: `backend/STATUS_BACKEND.md`.

## (imported) Auto Apply never submits

**Decision:** Automation fills fields and attaches files only. Final submission is always
a human action.
**Alternatives:** Fully automatic submission.
**Why:** It's a hard constraint set by the user. Stated in `AUTOMATION_NOTES.md` and in the
Auto Apply prompt template.

## (imported) 2026-09-18: Public demo is frontend-only with mocked data

**Decision:** The Vercel deployment is a frontend-only build (`NEXT_PUBLIC_DEMO_MODE=true`)
that serves static fixtures and canned revisions. There's no backend and no API key.
**Alternatives:** Deploy the real backend publicly.
**Why:** It costs nothing to host, keeps the API key away from the client, and the demo is
meant as a portfolio showcase, not a route to the real app. Source: `STATUS.md` at
c102d0d, `ARCHITECTURE.md`.

## (imported) 2026-09-18: No Cloudflare Tunnel / stable backend hostname

**Decision:** Decided against exposing the local backend via a tunnel. CORS stays open
(`*`).
**Alternatives:** Cloudflare Tunnel so a hosted frontend could reach the local backend.
**Why:** Auto Apply already needs Claude Code running locally against this project, so
the real backend never has to be reachable from anywhere else. Source: `STATUS.md` and
`TODO.md` at c102d0d.

## (imported) Ship inline editing without manual-edit protection

**Decision:** Inline editing shipped without tracking which fields were hand-edited.
**Alternatives:** A provenance flag that protects hand edits from later chat revisions.
**Why:** Keep it simple and revisit only if overwrites turn out to be a real problem.
Source: `TODO.md` at c102d0d.

## 2026-10-04: Adopt docs/STATUS.md, docs/TODO.md, docs/decisions.md

**Decision:** Fold root `STATUS.md`/`TODO.md` into `docs/`. Keep `ARCHITECTURE.md`,
`AUTOMATION_NOTES.md`, `backend/CLAUDE_CODE_CONTEXT.md`, and both subfolder STATUS files
as reference.
**Alternatives:** Leave the old docs as the source of truth, or delete everything after
folding.
**Why:** The user's standard workflow (`/new-project`, `/wrapup`) expects these three files.
The subfolder STATUS files still hold implementation detail worth keeping.

## 2026-10-04: Background agents are the default workers; windows are opt-in

**Decision:** The manager starts background `backend`/`frontend` agents
(`.claude/agents/*.md`) by default. Before each task it checks `ListAgents`, and if the user
has opened a window for a side, it uses that window instead of starting an agent.
**Alternatives:** Always use user-opened windows (the previous setup), or always use
background agents.
**Why:** Background agents remove the manual window setup while keeping the manager's
planning context separate from worker execution. Windows stay available for features the
user wants to watch or steer directly. Not yet tried on a real feature.

## 2026-10-04: Manager makes all commits in manager mode

**Decision:** Workers (background or window) never commit. After the verifier passes and the
user approves, the manager commits worker files and `docs/` with explicit paths.
**Alternatives:** Each worker commits its own files after the manager relays approval.
**Why:** Matches `/wrapup` (the session running it proposes and makes the commit) and avoids
relay round trips. Committing isn't a code edit, so the manager still makes no code changes.

## 2026-10-04: Keep `backend/STATUS_BACKEND.md` as a live dated log

**Decision:** Backend workers keep adding dated sections at the end of it. Its header was
updated and its stale closing sections retired in favor of `docs/TODO.md`.
**Alternatives:** Freeze it as history.
**Why:** It holds per-feature verification detail that doesn't belong in `docs/STATUS.md`.

## 2026-10-04: Live tests require `RUN_LIVE=1`

**Decision:** `conftest.py` skips `live` tests unless `RUN_LIVE=1` is set, on top of
`pytest.ini`'s `-m "not live"`.
**Alternatives:** Rely on `pytest.ini` plus permission ask rules.
**Why:** The verifier showed `backend/.venv/bin/pytest` run from the repo root ignores
`pytest.ini` and would run live tests, and prefix-based ask rules are easy to bypass
(`-q -m live`). The environment-variable guard holds however pytest is invoked.

## 2026-10-04: Move ARCHITECTURE.md and AUTOMATION_NOTES.md into docs/

**Decision:** Both now live in `docs/`. The repo root keeps only `README.md` and `CLAUDE.md`.
Earlier entries in this file that cite them by their old root paths are left as written.
**Alternatives:** Leave them at the root.
**Why:** They're reference docs agents maintain, like the rest of `docs/`. `decisions.md`
stays lowercase because the user's global `/wrapup` and `/new-project` expect that exact path.

## 2026-10-04: Lowercase file names in docs/

**Decision:** Every file in `docs/` uses a lowercase, hyphenated name (`status.md`, `todo.md`,
`decisions.md`, `architecture.md`, ...). A root `ARCHITECTURE.md` moves to
`docs/architecture.md`. `README.md` and `CLAUDE.md` stay uppercase at the root. Earlier
entries here keep the old names as written.
**Alternatives:** Keep the mixed casing (uppercase `STATUS.md`/`TODO.md`, lowercase
`decisions.md`).
**Why:** The user wanted consistent names. Lowercase with hyphens is the common convention
inside docs folders. Changed at the same time in the global config (`~/Dev/claude-config`).

## 2026-10-04: Window workers may commit when the user tells them to directly

**Decision:** Clarifies "Manager makes all commits": a worker in a window the user is driving
directly follows the user's own instruction to commit. Background workers never commit.
**Alternatives:** No exception, so the user would have to route every commit through the
manager.
**Why:** A window exists so the user can control that side directly. The agent files already
said this, and `/manager-startup` now matches them.
