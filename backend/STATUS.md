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
- `POST /generate` → takes `{job_description, company_context?, type?}`, calls Claude
  (`claude-sonnet-4-6`), returns either a tailored Resume JSON or a Cover Letter JSON
  depending on `type` (new). Verified end-to-end for resumes — correctly tailored
  bullets, valid schema, new bullet IDs generated, irrelevant experience dropped, no
  fabricated content.
  - **`type: "resume" | "cover_letter"`** (new, defaults to `"resume"` for backward
    compatibility) — the route branches on `req.type` and calls either `generate_resume`
    or the new `generate_cover_letter` (`app/services/llm.py`), returning
    `{"resume": ...}` or `{"cover_letter": ...}` respectively (`GenerateResponse` now
    has both fields as `Optional`, with the unused one `null`). An unrecognized `type`
    (e.g. `"resignation_letter"`) is checked and rejected with a clean **400** before
    the try/except around the LLM call even begins — not just re-raised from inside a
    broad except — so it can never be accidentally caught by the `ValueError`/
    `RuntimeError` handlers. Verified: `type: "resume"` behavior is unchanged from
    before this pass; `type: "cover_letter"` with a real job description produced 3
    grounded body paragraphs with sequential `p1`/`p2`/`p3` ids, `meta.company`/
    `meta.role` correctly extracted from the JD, `meta.date` empty as instructed, and
    `resume: null` in the response; an invalid `type` returned 400 (not 500); an
    oversized `job_description` was rejected the same way (502, counter untouched) for
    cover letter generation as for resume generation; `GET /usage` incremented
    identically for a cover-letter call, confirming it shares the same daily cap.
  - **New models** (`app/models.py`): `CoverLetterMeta` (`name`, `email`, `phone`,
    `date`/`company`/`role` all defaulting to `""`), `Paragraph` (`id`, `text`), and
    `CoverLetter` (`type: "cover_letter"`, `meta: CoverLetterMeta`,
    `paragraphs: list[Paragraph]`) — same selection model as resume bullets, each
    paragraph independently addressable by `id` for future revision.
  - **Known gap, intentional**: `ReviseRequest` now accepts an optional `cover_letter`
    field alongside `resume`, but `revise_resume`/the `/revise` route have **not** been
    updated to branch on it — `/revise` does not yet support revising cover letter
    paragraphs. This is deferred to the frontend-adjacent backend pass that builds out
    cover letter selection/revision in the UI, not an oversight in this pass.
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
- `POST /render` (new) → takes `{resume: Resume, format: "docx" | "pdf"}` (`format`
  defaults to `"docx"`), returns a downloadable file (not a JSON body). Pure templating
  via `python-docx` — **makes no LLM call**, so it does not go through `usage_guard` and
  never counts against the daily call cap (explicitly commented in `app/routes/render.py`
  so the omission reads as intentional, not missed).
  - **`.docx` generation**: centered bold name + contact line, summary paragraph, then
    each section as an uppercase bold heading; experience/project entries get a bold
    `Title — Organization` line with the dates right-tab-aligned on the same line, an
    italic location line, and bullets rendered with Word's built-in "List Bullet" style;
    education/certification entries render as a single plain line; skills groups render
    as `**Label:** item, item, ...`. No tables, columns, headers/footers, or graphics —
    plain and ATS-friendly by construction.
  - **`.pdf` generation**: the `.docx` is always built first with the exact same
    `render_resume_docx` logic, then converted to PDF by shelling out to **headless
    LibreOffice** (`app/services/render.py`'s `convert_docx_to_pdf`) — no separate PDF
    layout code to maintain. Requires LibreOffice installed locally
    (`brew install --cask libreoffice`); this is now a **system dependency of the
    project**, not a pip package. `SOFFICE_PATH` is hardcoded to the default macOS
    Homebrew cask location (`/Applications/LibreOffice.app/Contents/MacOS/soffice`) — if
    this ever runs on a different machine or OS, that path needs to change.
    Conversion uses a 30-second subprocess timeout. During testing, the **first**
    conversion after a fresh server start took ~22s (LibreOffice cold-starting its
    background process/profile) — close to the timeout but under it — while subsequent
    conversions in the same server run took ~8s. If conversions ever time out in
    practice, this cold-start cost is the first thing to suspect; a longer timeout or a
    documented "warm up LibreOffice once after starting the server" step would be the fix.
  - Invalid `format` values (anything other than `"docx"`/`"pdf"`) return a clean
    **400**, not a stack trace.
  - Both the `.docx` and (when requested) the `.pdf` are written into the same
    `tempfile.mkdtemp()` directory per request and the whole directory is deleted via a
    `BackgroundTask` after the response is sent — nothing persists on disk afterward,
    regardless of format.
  - Verified: ran a resume through `/generate` → `/revise` → `/render`, confirmed
    `format: "docx"` behavior is unchanged from before this pass; confirmed
    `format: "pdf"` returns a real 2-page PDF with correct `content-type`/
    `Content-Disposition`; confirmed an invalid format (`"txt"`) returns 400; confirmed
    `GET /usage` is unaffected by any `/render` call regardless of format. Did not do a
    byte-level text diff between the `.docx` and `.pdf` output (no PDF text-extraction
    tool was available locally) — relying on LibreOffice's well-established fidelity for
    docx→pdf conversion plus the already-verified correctness of the source `.docx`.

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
`SkillGroup` — used as originally specified, no shape changes needed. `CoverLetterMeta`,
`Paragraph`, `CoverLetter` are new (see `/generate` section above). `GenerateRequest`
gained a `type` field; `GenerateResponse` and `ReviseRequest` were loosened to hold
either a `resume` or a `cover_letter` (both `Optional`) rather than a single required
`Resume`.

**`app/data/profile.json`** — master profile, expanded from 6 resume PDFs (devops, backend,
frontend, testing, technician, electrical). Current contents:
- **Experience** (6 entries): Salo Labs LLC (software/DevOps, current), SandCastle/GFiber
  (fiber tech, current), Freelance Full-Stack (Oct 2024–Jan 2026, backend + frontend
  bullets), Polaris Communications, Unmuted Communications, DCOMM/Spectrum (fiber/cable
  tech roles, 2018–2023)
- **Projects** (4 entries): Weather Alerts API Backend, React Native Weather App,
  Route Planning Web App, ATX Reliable Wrenching (freelance client site)
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
  prebuilt `pydantic-core` wheel yet and compiling from source originally failed locally
  because Xcode's license wasn't accepted. The Xcode license has since been accepted
  (`sudo xcodebuild -license accept`, run by the user) and Homebrew now works normally —
  but the decision to stay on 3.13 stands (user confirmed "3.13 is fine, keep it"); don't
  reopen this unprompted just because 3.12 could now be installed.
- **LibreOffice** (new system dependency, installed via `brew install --cask libreoffice`)
  — required for PDF export via `/render`. Not a pip package; see the `/render` section
  above for details on the headless conversion and its hardcoded install path.
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

## Frontend Phase 1 — Connectivity check (2026-09-12)

Following `frontend/STATUS.md`'s phased build guide, Phase 1 is done and verified:
- `frontend/.env.local` (gitignored — `.env*` was already covered in `frontend/.gitignore`)
  holds `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`.
- `app/page.tsx` (client component, `"use client"`) replaces the default `create-next-app`
  boilerplate with a `useEffect` fetch to `${NEXT_PUBLIC_API_URL}/health` on load, tracked
  via a `loading | ok | error` state.
- Verified both states in a real browser (Chrome, via `next dev` on `localhost:3000`):
  with the backend up, renders "Backend: ok"; with `NEXT_PUBLIC_API_URL` pointed at an
  unreachable port, renders "Backend unreachable: Failed to fetch" instead of a silent
  failure or unhandled exception.
- CORS did not need any adjustment — still wide open (`allow_origins=["*"]`) from the
  backend side, as expected for local dev.
- Read `node_modules/next/dist/docs/01-app/{01-getting-started/05-server-and-client-components,02-guides/environment-variables}.md`
  first per the frontend's `AGENTS.md` (this Next.js version, 16.3.5, warns of breaking
  changes from training data) — both `NEXT_PUBLIC_` env var handling and `"use client"`
  matched standard conventions, no surprises for this phase.

## Frontend Phase 2 — Generate view, resume only, unstyled (2026-09-12)

- `app/page.tsx` now has a form (job description textarea, required; optional company
  context textarea) that `POST`s to `/generate` with `{job_description, company_context,
  type: "resume"}` on submit, using `GenerateState` (`idle | loading | success | error`)
  to drive the UI — button disabled and reads "Generating..." while in flight, shows a
  clear inline error message on failure (non-2xx status or network error), otherwise
  renders the returned `resume`.
- Render is a minimal but structured `ResumeRaw` component (not a bare `<pre>` dump):
  name/contact, summary, each section with entries (title — org, dates, location,
  bullets) or skill groups — plus a collapsed `<details>` with the full raw JSON for
  debugging. Deliberately unstyled/basic per the phase goal; real visual polish and
  the 3-level selection UI are Phase 3.
- Verified end-to-end in a real browser: submitted a real backend/Python job description,
  got back a correctly tailored resume (relevant bullets surfaced, skills reordered
  toward the JD, no fabricated content) rendering with sensible structure. No console
  errors during the run.
- Types in the frontend (`Resume`, `Section`, `Entry`, `Bullet`, `SkillGroup`, `Meta`)
  are hand-mirrored from `app/models.py` rather than shared/generated — fine for now
  given the small surface area, but worth revisiting (e.g. OpenAPI codegen) if the
  shapes start drifting.

## Frontend Phase 3 — Resume-styled preview + 3-level selection (2026-09-12)

- New `app/types.ts` centralizes the hand-mirrored `Resume`/`Section`/`Entry`/`Bullet`/
  `SkillGroup`/`Meta` types shared between `page.tsx` and the new components (previously
  duplicated inline in `page.tsx` from Phase 2).
- New `app/components/Selectable.tsx`: a small polymorphic (`as="div" | "li"`) wrapper
  that gives any node hover + click-to-toggle-persistent-selection behavior, reading
  from/writing to a `selectedIds: Set<string>` passed down from `page.tsx`. Hover
  highlight is pure CSS (Tailwind `hover:bg-*`), so it's automatically transient with no
  state involved; click handlers call `e.stopPropagation()` so clicking a bullet doesn't
  also toggle its parent entry/section (click bubbles natively in React, unlike
  hover/enter events, so this was required for correctness).
- New `app/components/ResumePreview.tsx`: renders the resume to visually match
  `render.py`'s docx template — centered bold name + contact line, summary paragraph,
  uppercase bold section headings, experience/project entries with bold `Title —
  Organization` and same-line dates (flexbox instead of docx's right tab-stop, close
  enough visually), italic location, bulleted lists; education/certification entries as
  single plain lines; skills as bold label + comma-separated items. Font is the browser
  default sans-serif rather than Calibri (not embedded/loaded) — cosmetic-only deviation.
- Selection wraps each **bullet** (`<li>`), each **entry** (job/project block, and each
  education/certification line), and each whole **section** (e.g. all of Skills) — the
  three levels named in the phase goal. The resume's `summary` is deliberately **not**
  independently selectable in this phase — the phase spec named only bullet/entry/section
  as the three selectable levels, so summary selection wasn't added; Phase 4 will need to
  decide how a summary edit gets scoped, since `/revise` does accept a summary id.
- `selectedIds` lives in `page.tsx` as `Set<string>`, separate from `resume` state, reset
  to empty on every new `/generate` call. A small indicator above the preview shows
  "Selected: N items" (or a hint to click something, when empty).
- Verified live in the browser: hovering a bullet inside an already-selected entry shows
  its own subtle transient tint distinct from the entry's persistent selection ring;
  clicking a bullet, an entry, and a whole section in sequence brought the counter to
  "Selected: 3 items" with all three highlighted simultaneously and independently
  (nesting a selected bullet inside a selected entry rendered correctly, each with its
  own visual state); clicking the already-selected bullet again deselected it (counter
  dropped to 2) while the entry and section selections were untouched. No console errors.
- Fixed one pre-existing lint error surfaced by this pass (not introduced by it):
  `page.tsx`'s Phase 1 connectivity-check effect called `setState` synchronously in the
  effect body for the "env var missing" branch, which `eslint-config-next`'s
  `react-hooks/set-state-in-effect` rule (new in this Next.js version's stricter
  React-Compiler-aware lint rules) flags as an error. Fixed by computing that case in
  `useState`'s lazy initializer instead, so the effect body only ever calls `setState`
  from inside the `fetch().then()/.catch()` callbacks.

## Not yet built (explicitly deferred so far)

1. **Next.js frontend** — Phases 1–3 done, see above. Phases 4–6 (chat-scoped revision,
   cover letter mode, download) not yet started — see `frontend/STATUS.md` for the full
   phased plan.
2. **Cloudflare Tunnel** — stable hostname to expose the local backend to the
   Vercel-hosted frontend. Not started.

## Open questions worth strategizing on

- **Backend trio is now complete**: `/generate`, `/revise`, and `/render` are all built
  and verified, alongside `/profile` and the usage guardrails. Frontend Phases 1–3
  (connectivity, generate view, styled preview + selection) are done — next step is
  Phase 4 (wiring the current selection to `/revise`), per `frontend/STATUS.md`'s phased
  plan. That phase needs to specifically test whole-section-id selection against
  `/revise`, since the system prompt currently only knows how to expand entry ids to
  their bullets, not section ids — flagged in `frontend/STATUS.md`'s "Known gaps" list.
- Whether to bump `MAX_INPUT_CHARS` or `DAILY_CALL_LIMIT` once real usage patterns are
  known (e.g. a very long job posting, or heavier revise-loop iteration during editing).
