# Resume Builder — Status Report

_Last updated: 2026-09-12_

## What this project is

Personal tool to speed up job applications. Paste a job description → FastAPI backend
calls Claude to tailor a resume from a master profile → user edits pieces via chat-scoped
revision → downloads a formatted .docx. See `CLAUDE_CODE_CONTEXT.md` for the full original
spec/architecture doc this was built from.

## Repo state

- Monorepo: `/backend` (this folder, built) and `/frontend` (not started).
- Private GitHub repo, `main` branch, pushed and up to date with `origin/main`.
- Backend runs **locally only**, no database — `app/data/profile.json` is the persistence layer.

## What's built and verified working

**Endpoints** (FastAPI, `app/main.py`):
- `GET /health` → `{"status": "ok"}`
- `GET /profile` / `PUT /profile` → reads/writes `app/data/profile.json`
- `GET /usage` (new) → `{"calls_today": <n>, "limit": <DAILY_CALL_LIMIT>}` — see Usage
  Guardrails below.
- `POST /generate` → takes `{job_description, company_context?}`, calls Claude
  (`claude-sonnet-4-6`), returns a tailored Resume JSON. Verified end-to-end — correctly
  tailored bullets, valid schema, new bullet IDs generated, irrelevant experience dropped,
  no fabricated content.
- `POST /revise` → takes `{selected_ids, instruction, resume}`, returns
  `{updates: [{id, text}]}` for only the requested IDs. Does not read `profile.json` at all
  — operates solely on the resume JSON in the request body, since revision needs no master
  data. Verified with both:
  - **Bullet-level IDs** — returns revised text for exactly those bullets, nothing else touched.
  - **Entry-level IDs** (a whole job block) — expands to one update per bullet under that
    entry, using each bullet's own id (the entry id itself never appears in the response,
    since `ReviseUpdate` is just `{id, text}` and only bullet/summary ids map to an actual
    string field). Entries with no bullets (education/certifications) are skipped rather
    than having bullets invented for them.
- `POST /render` (new) → takes `{resume: Resume}`, returns a downloadable `.docx` file
  (not a JSON body). Pure templating via `python-docx` — **makes no LLM call**, so it does
  not go through `usage_guard` and never counts against the daily call cap (explicitly
  commented in `app/routes/render.py` so the omission reads as intentional, not missed).
  - **Format decision: `.docx`, not PDF** — `python-docx` produces clean, well-formatted
    output directly; `.docx` is a normal, expected format for job applications, and
    avoids pulling in a separate PDF-rendering pipeline for no real benefit here.
  - Output layout: centered bold name + contact line, summary paragraph, then each
    section as an uppercase bold heading; experience/project entries get a bold
    `Title — Organization` line with the dates right-tab-aligned on the same line, an
    italic location line, and bullets rendered with Word's built-in "List Bullet" style;
    education/certification entries render as a single plain line; skills groups render
    as `**Label:** item, item, ...`. No tables, columns, headers/footers, or graphics —
    plain and ATS-friendly by construction.
  - File is written to a fresh `tempfile.mkdtemp()` directory per request and deleted via
    a `BackgroundTask` after the response is sent — nothing persists on disk afterward.
  - Verified: ran a resume through `/generate` → `/revise` → `/render` in sequence, then
    inspected the resulting `.docx` programmatically with `python-docx` (paragraph text,
    styles, bold/italic/size on every run) to confirm structure and formatting are all
    correct — name/contact/summary at top, section headings present, experience/project
    bullets are actual "List Bullet"-styled paragraphs, education/certs are single lines,
    skills groups render with a bold label. Also confirmed `GET /usage` was unaffected by
    the `/render` calls.

**`app/services/llm.py`**: `generate_resume` and `revise_resume` share a single
`_extract_json` helper for stripping markdown fences and parsing/validating the model's
JSON output.

**Usage guardrails** (new — `app/services/usage_guard.py`):
- **Daily call cap**: an in-memory counter (`DAILY_CALL_LIMIT = 50`) shared by both
  `generate_resume` and `revise_resume`, checked and incremented right before each
  Anthropic API call. Resets automatically at midnight (date-based) or whenever the
  server process restarts — no persistence, no cross-process coordination, by design
  (single-user, single-process, locally-run tool). Once the cap is hit, further calls
  return **HTTP 429** with a message naming the limit and pointing at the constant to
  raise it. A call counts once it's attempted, even if the model's response then fails
  to parse as JSON (a separate 502) — this was actually triggered during testing (a
  throwaway job description like "test call two" made the model reply in prose asking
  for a real JD instead of returning JSON) and confirmed both paths compose correctly:
  the attempt still consumed a quota slot, and the cap was never exceeded.
- **Input length guard**: `MAX_INPUT_CHARS = 20000` in `llm.py`. `job_description` and
  `company_context` are checked in `generate_resume`; `instruction` in `revise_resume`.
  Oversized input raises `ValueError` before any API call is made (surfaces as the
  existing 502 path, consistent with other input-shape problems). Verified: a
  20,001-character `job_description` was rejected immediately with the counter
  untouched.
- Both routes (`generate.py`, `revise.py`) now catch `RuntimeError` from the usage guard
  and return 429, alongside the existing `ValueError` → 502 handling.
- **This is supplementary, not the real backstop** — the actual safety net against
  runaway spend is a manually-configured spend limit in the Anthropic console
  (Settings → Billing). Set that yourself if you haven't already; the in-app cap just
  makes a bug or accidental loop fail fast with a clear local error instead of quietly
  burning through calls before the console limit would ever kick in.

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
- **`summary_pool`** (4 variants): 2 software-engineering-oriented, plus 2 field/technician
  summaries covering the fiber/cable/telecom experience and the Apprentice Electrician
  License, so `/generate` has appropriate material for a technician-track job description.
- **Meta links**: GitHub, LinkedIn, personal website (renemsdev.com)

Every bullet/entry/section has a stable ID; profile spans both the software-engineering
track and the field-technician/telecom track (all real experience, kept in one master file
since tags let `/generate` filter per job description). The 6 source resume PDFs used to
build this out have been removed from the repo (identical copies remain at
`~/Desktop/current resumes/`, outside the project).

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
- The daily call counter is in-memory only — it resets every time `--reload` restarts the
  process (e.g. on any tracked file save), so don't rely on `/usage` reflecting cumulative
  usage across a dev session with frequent code edits. This is expected and fine for the
  guardrail's actual purpose (catching a runaway loop within one running process).
- **The `.venv` can silently get corrupted by something outside this session** (most
  likely IDE Python tooling) running `python3.14 -m venv .venv` on top of the existing
  3.13 venv without clearing it first. This happened once already: `pyvenv.cfg` got
  rewritten to point at 3.14, a stray `.venv/bin/python3.14` symlink appeared, and `pip`
  started installing packages into a 3.14 `site-packages` tree while `.venv/bin/python`
  still resolved to 3.13 — so newly-installed packages (`python-docx`) were invisible to
  the actual interpreter uvicorn runs, and the server crashed on import. Fix was to
  `rm -rf .venv` and rebuild fresh with `/usr/local/bin/python3.13 -m venv .venv`. If
  `ModuleNotFoundError` shows up for a package `pip show` claims is installed, check
  `.venv/pyvenv.cfg` and `.venv/bin/python*` symlinks for this same mismatch before
  assuming it's a code bug.

## Not yet built (explicitly deferred so far)

1. **Next.js frontend** — two-pane layout: selectable resume preview + chat input scoped
   to the current selection. Deploys to Vercel. Not started.
2. **Cloudflare Tunnel** — stable hostname to expose the local backend to the
   Vercel-hosted frontend. Not started.

## Open questions worth strategizing on

- **Backend trio is now complete**: `/generate`, `/revise`, and `/render` are all built
  and verified, alongside `/profile` and the usage guardrails. The next step is starting
  the **Next.js frontend skeleton** (two-pane layout, selection + chat-scoped revision,
  wired up to these four endpoints) — flagging this as the natural next pass, not
  starting it yet.
- Whether to bump `MAX_INPUT_CHARS` or `DAILY_CALL_LIMIT` once real usage patterns are
  known (e.g. a very long job posting, or heavier revise-loop iteration during editing).
