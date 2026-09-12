# Resume Builder — Status Report

_Last updated: 2026-09-12_

## What this project is

Personal tool to speed up job applications. Paste a job description → FastAPI backend
calls Claude to tailor a resume from a master profile → user edits pieces via chat-scoped
revision → (future) export docx/pdf. See `CLAUDE_CODE_CONTEXT.md` for the full original
spec/architecture doc this was built from.

## Repo state

- Monorepo: `/backend` (this folder, built) and `/frontend` (not started).
- Private GitHub repo, `main` branch.
- Backend runs **locally only**, no database — `app/data/profile.json` is the persistence layer.
- **Pending, not yet committed**: the `backend/current resumes/` folder (6 source PDFs) was
  deleted from disk — identical copies already live at `~/Desktop/current resumes/`, so
  nothing was lost — but `git add`/commit of that deletion is still outstanding. Claude Code's
  auto-mode safety classifier blocked staging it directly (flagged as sensitive-source
  provenance, likely due to touching personal-document files); run `git add "backend/current
  resumes" && git commit` yourself to finalize the removal from version control.

## What's built and verified working

**Endpoints** (FastAPI, `app/main.py`):
- `GET /health` → `{"status": "ok"}`
- `GET /profile` / `PUT /profile` → reads/writes `app/data/profile.json`
- `POST /generate` → takes `{job_description, company_context?}`, calls Claude
  (`claude-sonnet-4-6`), returns a tailored Resume JSON. Verified end-to-end — correctly
  tailored bullets, valid schema, new bullet IDs generated, irrelevant experience dropped,
  no fabricated content.
- `POST /revise` (new) — takes `{selected_ids, instruction, resume}`, returns
  `{updates: [{id, text}]}` for only the requested IDs. Does not read `profile.json` at all
  — operates solely on the resume JSON in the request body, since revision needs no master
  data. Verified with both:
  - **Bullet-level IDs** (e.g. `b_salo_1_r2`, `b_salo_2_r2`) — returned revised text for
    exactly those two bullets, nothing else touched.
  - **Entry-level IDs** (e.g. `entry_freelance`, a whole job block) — see design decision
    below.

  **Design decision — entry-level selection**: an entry ID has no single revisable text
  field (it's title/org/location/dates + a bullet list), so selecting an entry means
  "revise every bullet under it." The model returns one update per *bullet's own id*
  under that entry — the entry id itself never appears in the response, since
  `ReviseUpdate` is just `{id, text}` and only bullet/summary ids map to an actual string
  field the frontend can splice back in. If a selected entry has no bullets (education/
  certification entries), it's skipped — nothing to revise, and the prompt explicitly
  tells the model not to invent bullets to fill that gap. Verified: selecting
  `entry_freelance` with "emphasize ownership and business impact" returned 3 updates,
  one per existing bullet ID under that entry, correctly rewritten and nothing fabricated.

**`app/services/llm.py`** refactored: both `generate_resume` and `revise_resume` now share
a single `_extract_json` helper for stripping markdown fences and parsing/validating the
model's JSON output, instead of duplicating that logic.

**Data model** (`app/models.py`): `Profile`, `Resume`, `Section`, `Entry`, `Bullet`,
`SkillGroup`, `GenerateRequest`/`Response`, `ReviseRequest`/`Response` — all used as
originally specified, no shape changes needed.

**`app/data/profile.json`** — master profile, expanded from 6 resume PDFs (devops, backend,
frontend, testing, technician, electrical). Current contents:
- **Experience** (6 entries): Salo Labs LLC (software/DevOps, current), SandCastle/GFiber
  (fiber tech, current), Freelance Full-Stack (Oct 2024–Jan 2026, backend + frontend
  bullets), Polaris Communications, Unmuted Communications, DCOMM/Spectrum (fiber/cable
  tech roles, 2018–2023)
- **Projects** (3 entries): Weather Alerts API Backend, React Native Weather App,
  Route Planning Web App
- **Education**: WGU BS Computer Science
- **Certifications** (6): AWS Cloud Practitioner, Linux Essentials, ITIL 4, PSM I,
  Apprentice Electrician License, AWS Solutions Architect (in progress)
- **Skills** (9 groups): Cloud, DevOps, Backend, Frontend, Mobile, Databases, Testing,
  Field/Low-Voltage, Tools
- **`summary_pool`** (4 variants, up from 2): 2 software-engineering-oriented, plus 2 new
  field/technician-track summaries covering the fiber/cable/telecom experience and the
  Apprentice Electrician License, so `/generate` has something appropriate to draw from
  if a job description is clearly technician-track rather than software.
- **Meta links**: GitHub, LinkedIn, personal website (renemsdev.com)

Every bullet/entry/section has a stable ID; profile spans both the software-engineering
track and the field-technician/telecom track (all real experience, kept in one master file
since tags let `/generate` filter per job description).

## Environment / infra notes (non-obvious, worth knowing before touching setup)

- **Python 3.13**, not 3.14 (system default) or 3.12 (originally requested). 3.14 has no
  prebuilt `pydantic-core` wheel yet and compiling from source fails locally because Xcode's
  license isn't accepted (`sudo xcodebuild -license accept` — needs an interactive password
  Claude can't supply). 3.12 isn't installed and installing it via Homebrew is blocked by the
  same license issue. User confirmed keeping 3.13.
- **`anthropic==1.5.0`** in `requirements.txt`, not the spec's `0.39.0` — 0.39.0 crashes on
  import against modern `httpx` (`proxies` kwarg removed). Don't revert this.
- Server currently expected to be run manually in its own terminal:
  `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`
- `.env` holds the real `ANTHROPIC_API_KEY`, gitignored, already set.
- CORS in `main.py` is still wide open (`allow_origins=["*"]`) — intentionally left as-is
  until a real frontend origin exists to lock it down to.

## Not yet built (explicitly deferred so far)

1. **`/render` endpoint** — Resume JSON → downloadable docx/pdf (likely `python-docx`).
2. **Next.js frontend** — two-pane layout: selectable resume preview + chat input scoped
   to the current selection. Deploys to Vercel. Not started.
3. **Cloudflare Tunnel** — stable hostname to expose the local backend to the
   Vercel-hosted frontend. Not started.

## Open questions worth strategizing on

- **Next build target**: `/render` (docx/pdf generation — unblocks actually producing a
  usable resume file end-to-end) vs. starting the Next.js frontend skeleton (see the UX
  shape, exercise `/generate` + `/revise` from a real client). Not picking one
  unilaterally — flagging for the same strategizing pass as last time.
- Finalize the `current resumes/` folder removal from git (see "Pending" note above —
  needs a manual `git add`/commit since Claude's auto-mode blocked it).
