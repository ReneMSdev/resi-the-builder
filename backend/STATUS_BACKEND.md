# Resume Builder — Status Report

_Last updated: 2026-09-16_

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
  - **(Closed 2026-09-12, see "Backend gap-closure" section below)**: `/revise` now
    branches on `ReviseRequest.cover_letter` and supports cover letter paragraph revision.
- `POST /revise` → takes `{selected_ids, instruction, resume?, cover_letter?}` (exactly one
  of `resume`/`cover_letter` expected; neither present is a clean 400), returns
  `{updates: [{id, text}]}` for only the requested IDs. Does not read `profile.json` at all
  — operates solely on the JSON in the request body, since revision needs no master data.
  Verified with:
  - **Bullet-level IDs** — returns revised text for exactly those bullets, nothing else touched.
  - **Entry-level IDs** (a whole job block) — expands to one update per bullet under that
    entry, using each bullet's own id (the entry id itself never appears in the response,
    since `ReviseUpdate` is just `{id, text}` and only bullet/summary ids map to an actual
    string field). Entries with no bullets (education/certifications) are skipped rather
    than having bullets invented for them.
  - **Section-level IDs** (new, 2026-09-12) — expands to one update per bullet across ALL
    entries in that section (e.g. `sec_experience` → all 9 bullets across its 2 entries).
    Sections with no bullet-bearing entries (`skills`, or `education`/`certifications`
    whose entries have no bullets) correctly no-op with `{"updates": []}` rather than
    erroring. See "Backend gap-closure" section below for full verification detail.
  - **Cover letter paragraph IDs** (new, 2026-09-12) — `revise_cover_letter` revises only
    the selected paragraph(s) by id. See "Backend gap-closure" section below.
- `POST /render` → takes `{resume?: Resume, cover_letter?: CoverLetter, format: "docx" |
  "pdf"}` (exactly one of `resume`/`cover_letter` expected; neither present is a clean 400;
  `format` defaults to `"docx"`), returns a downloadable file (not a JSON body). Pure
  templating via `python-docx` — **makes no LLM call**, so it does not go through
  `usage_guard` and never counts against the daily call cap (explicitly commented in
  `app/routes/render.py` so the omission reads as intentional, not missed). Cover letter
  rendering (`render_cover_letter_docx`, new 2026-09-12) is documented in "Backend
  gap-closure" below; resume rendering is unchanged from before that pass.
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

Following `frontend/STATUS_FRONTEND.md`'s phased build guide, Phase 1 is done and verified:
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

## Frontend Phase 4 — Chat-scoped revision (2026-09-12)

- New `app/lib/resume.ts`: `applyRevisionUpdates(resume, updates)` immutably patches
  bullet text (and summary text, if `resume.summary.id` is ever among the returned ids)
  in place given `/revise`'s `{id, text}` updates, matching by id anywhere in the tree
  rather than assuming a shape — needed since entry-id selections come back as several
  bullet-id updates. `describeSelection(resume, selectedIds)` turns the current
  `selectedIds` into the "Editing: N bullets, M entries" label.
- New `app/components/RevisionChat.tsx`: a sticky-to-viewport-bottom bar (pinned at the
  bottom of the preview pane per the phase's suggested placement) with a text input +
  "Revise" button. Disabled/inert whenever nothing is selected, with an explanatory
  placeholder message; shows the live "Editing: ..." summary otherwise.
- `page.tsx` wires it up: `handleRevise` posts `{selected_ids: Array.from(selectedIds),
  instruction, resume}` to `/revise`, and on success runs `applyRevisionUpdates` over the
  current `generateState.resume` and replaces it — **`selectedIds` and the instruction
  input's typed text are the only two things cleared/reset differently**: the instruction
  text field clears after a successful submit (normal chat-input UX), but `selectedIds`
  is deliberately left untouched so a follow-up instruction can be submitted against the
  same selection, exactly as the phase spec required. A separate `reviseState` (`idle |
  loading | error`) drives the button's "Revising..." label and an inline error message,
  independent of `generateState` — a failed revise never clears the currently-generated
  resume or the selection.
- **Verified bullet-level revision end-to-end through the UI**: selected a single bullet,
  submitted "make this more concise", got back exactly one update, patched in place with
  nothing else in the resume shifting, selection preserved afterward.
- **Verified entry-level revision end-to-end through the UI**: selected a whole
  project/job entry (no individual bullets), submitted an instruction, and all bullets
  under that entry updated together (confirmed via the backend's existing entry→bullet
  expansion) while the entry itself stayed selected and nothing outside it changed.
- **Confirmed whole-section-level selection does NOT work against the current backend**:
  tested directly against a running `/revise` (`curl`, a hand-built resume payload,
  `selected_ids: ["sec_skills"]`) — the response was `{"updates": []}`, i.e. a silent
  no-op, because `REVISE_SYSTEM_PROMPT` (`backend/app/services/llm.py`) only tells the
  model how to expand bullet/summary/entry ids, not section ids, so an unrecognized
  section id is just dropped. Per the phase's explicit instruction not to fix backend
  gaps from the frontend, **section-level selection has been removed from the UI**
  (`ResumePreview.tsx` now renders each section's heading/content in a plain `<div>`
  instead of a `Selectable`, with a comment explaining why) rather than leaving a
  selectable-but-nonfunctional control in place. This is a real backend gap, not a
  frontend workaround-needed item: fixing it means teaching `REVISE_SYSTEM_PROMPT` to
  expand a section id to all of that section's bullets, mirroring the existing entry-id
  expansion — tracked in `frontend/STATUS_FRONTEND.md`'s "Known gaps" list.
- **Error handling**: confirmed via direct backend testing that an oversized instruction
  (>`MAX_INPUT_CHARS`) returns **502**, exercising the same `!res.ok` → inline error
  message path already proven working for `/generate` in Phase 2 (`handleRevise` mirrors
  `handleGenerate`'s error handling exactly). A 429 (daily call cap) would surface the
  same way; not separately re-tested since it shares the identical code path and would
  require exhausting the 50-call daily cap to trigger for real.
- One hydration console warning was observed during testing
  (`data-darkreader-proxy-injected="true"` mismatch) — confirmed to be the Dark Reader
  Chrome extension modifying the `<html>` tag before React hydrates, unrelated to any
  app code; not something to fix here.

## Frontend theme — cream + salmon (2026-09-12)

- User didn't like the dark theme, so the previous approach (Tailwind `dark:` variants
  following `prefers-color-scheme`, black/white/zinc/blue palette) was replaced with a
  single fixed light theme — no dark mode at all now, by request.
- All colors are CSS custom properties in `app/globals.css` (`--background`, `--surface`,
  `--foreground`, `--muted`, `--border`, `--accent`, `--accent-hover`, `--accent-soft`,
  `--success`, `--danger`), referenced from components via Tailwind arbitrary-value
  classes (e.g. `bg-[var(--accent)]`) rather than hardcoded hex/Tailwind color names, so
  the palette can be retuned from one place. `--background` is a warm cream (`#f6ecdb`),
  `--surface` a lighter off-white-cream for cards/inputs, text a dark brown
  (`--foreground: #3a2a1e`), and `--accent`/`--accent-hover` a salmon/coral
  (`#e8785a`/`#d9633f`) used for buttons and the bullet/entry selection ring
  (`--accent-soft`, a pale salmon wash, for both the transient hover tint and the fill
  behind a persistent selection).
- Every `dark:`, `zinc-*`, `blue-*`, `bg-black`/`bg-white`/`text-black`/`text-white`
  class across `app/` was swept out (confirmed via grep) — `page.tsx`,
  `components/Selectable.tsx`, `components/ResumePreview.tsx`,
  `components/RevisionChat.tsx` all now reference only the CSS variables above.
- **Found and worth flagging**: this machine's Chrome has the **Dark Reader** extension
  installed, which force-repaints pages dark regardless of the page's own CSS (confirmed
  via `getComputedStyle` — `--background` correctly resolves to the cream hex, but the
  painted body background was a dark brown until Dark Reader's injected
  `data-darkreader-*` attributes/style tags were stripped for a verification screenshot).
  If the cream/salmon theme still looks dark after this change, Dark Reader (or a similar
  extension) repainting `localhost:3000` is the first thing to check — not the app.

## Frontend Phase 5 — Cover letter mode (2026-09-12)

- `app/types.ts` gained `CoverLetterMeta`, `Paragraph`, `CoverLetter` types mirroring
  `backend/app/models.py`.
- `page.tsx` gained a `mode: "resume" | "cover_letter"` state with a Resume/Cover Letter
  tab toggle above the generate form. `GenerateState` is now a discriminated union
  (`kind: "resume" | "cover_letter"`) so the resume-only code (`handleRevise`,
  `ResumePreview` + `RevisionChat`) only ever runs against a `Resume`, never a
  `CoverLetter` — `handleRevise` bails immediately if the current state isn't
  `kind: "resume"`. `handleGenerate` sends `type: mode` to `/generate` and branches on
  which of `data.resume` / `data.cover_letter` should be present for the current mode.
  The button label also switches ("Generate Resume" / "Generate Cover Letter").
- New `app/components/CoverLetterPreview.tsx`: styled as a business letter — right-aligned
  date (only if `meta.date` is non-empty, never fabricated), a "Re: {role} at {company}"
  line when either is present, "Dear Hiring Manager," salutation (no addressee name in
  the schema), each paragraph, then "Sincerely," + name + contact line. Visually distinct
  from `ResumePreview` (letter format vs. resume sections) while matching its polish
  level (same surface/border/shadow tokens).
- Paragraph-level selection reuses the existing `Selectable` component (same hover/click/
  persistent pattern as resume bullets) — included for interaction consistency, but
  `RevisionChat` gained a `disabledReason` prop: when set, it forces the bar disabled
  regardless of `selectionCount` and shows that message in both the status line and the
  input's placeholder instead of the normal "Editing: ..." text, so a cover-letter
  paragraph can be selected but the chat visibly refuses to do anything with it (message
  used: "Cover letter editing isn't available yet — download and edit directly for now."),
  matching the phase's explicit instruction not to let a user submit an instruction that
  would silently fail.
- **Found and fixed during testing, not explicitly speced but a clear usability gap**:
  switching the mode tab did not reset `generateState`, so toggling from a just-generated
  cover letter back to "Resume" (without regenerating) left the old cover letter content
  on screen underneath the now-active "Resume" tab — confusing, since the visible content
  no longer matched the selected tab. Added `handleModeChange` (used by both tab buttons
  instead of calling `setMode` directly) which resets `generateState` to `idle` and
  clears `selectedIds` whenever the mode actually changes, so switching tabs always
  clears the previous mode's stale preview.
- Verified end-to-end in the browser: generated a real cover letter from a job
  description, confirmed it renders as a distinct business-letter layout (not a resume
  dump), selected a paragraph and saw the persistent salmon selection ring, confirmed the
  chat bar's disabled explanation shows in place of the normal prompt with the input and
  Revise button both disabled. Also generated a resume, switched to Cover Letter and back
  to Resume, and regenerated to confirm both modes still work independently and that
  switching tabs clears stale content per the fix above. No console errors from app code.
- Cover letter revision remains blocked on the same backend gap already tracked (not
  new): `/revise` doesn't handle the `cover_letter` field on `ReviseRequest` yet.

## Frontend Phase 6 — Download (2026-09-12)

- New `app/components/DownloadButtons.tsx`: two buttons ("Download .docx" / "Download
  .pdf"), each `POST`ing `{resume, format}` to `/render`, reading the response as a
  `Blob`, and triggering a real browser download via a temporary `<a download>` element
  (`URL.createObjectURL` + programmatic click, then `URL.revokeObjectURL` after).
  Filename is read from the response's `Content-Disposition` header (which `/render`
  already sets via FastAPI's `FileResponse(filename=...)`) with a generic fallback if
  that header is ever missing. Each button independently tracks its own loading state
  (`"Downloading..."` only on the one clicked) and shows an inline error message on
  failure (non-2xx status or network error) without disturbing the resume/selection
  state — mirrors the same fetch-error-handling shape used by generate/revise.
- Rendered in `page.tsx` next to the selection-count indicator, **only** in the
  `kind === "resume"` branch — the control does not exist at all in cover-letter mode
  (not just disabled), matching the phase's "disable/hide" instruction plus the existing
  Phase 5 precedent of hiding rather than half-supporting an unimplemented shape.
- Verified end-to-end in the browser: generated a resume, clicked "Download .docx" —
  network panel showed `POST /render` → 200, button returned to idle with no error;
  clicked "Download .pdf" the same way (LibreOffice conversion, ~10s) — also 200, no
  error. Could not directly inspect the saved files' bytes from this pass (no filesystem
  access to the browser's actual Downloads folder in this environment), but the 200
  responses, correct content flow, and lack of any console/network errors match the
  behavior already verified directly against `/render` in earlier backend-only testing
  (see the `/render` section above) — recommend the user do one manual spot-check
  (open the downloaded `.docx`/`.pdf`) since that last step wasn't independently
  re-verified here.
- Confirmed download controls are completely absent in Cover Letter mode (switched
  modes, generated a cover letter, no download buttons rendered) — restating the known
  gap: `/render` only accepts a `Resume` body (`RenderRequest.resume: Resume`, required),
  not a `CoverLetter`, so cover letter download/export has no backend support yet. Same
  category of gap as cover letter revision — tracked, not fixed in this pass.

**All 6 frontend phases are now complete.** Remaining work per the original plan: the two
backend gaps above (cover letter revise, cover letter render — plus the newly-found
section-id revise gap from Phase 4), then the Cloudflare Tunnel + Vercel deployment
infrastructure pass.

## Backend gap-closure — section revise, cover letter revise, cover letter render (2026-09-12)

All three backend gaps tracked from the frontend build are now closed and verified
directly against the running server (`curl` against `/revise` and `/render` with
hand-built payloads, checking status codes and response shapes, not just "should work").

**1. Section-id expansion in `/revise`** (`app/services/llm.py`)
- `REVISE_SYSTEM_PROMPT` gained a fourth ID-expansion rule alongside bullet/summary/entry:
  a section ID (e.g. `sec_experience`) now expands to one update per bullet across ALL
  entries in that section, using each bullet's own id — the section id itself must never
  appear in the output, matching the existing entry-expansion convention.
- Sections with nothing to revise (`skills`, which has `groups` not `entries`; or
  `education`/`certifications`, whose entries have no bullets) are documented as a clean
  no-op returning `{"updates": []}`, not an error.
- **Defensive fix, not just a prompt tweak**: added `_normalize_revise_result()`, called
  on the parsed JSON in both `revise_resume` and the new `revise_cover_letter` (below),
  which does `result.setdefault("updates", [])`. This was necessary because the model was
  observed returning bare `{}` for a no-op case instead of `{"updates": []}`, which would
  otherwise fail `ReviseResponse` validation and 500 instead of cleanly no-opping — the
  fix does not rely on prompt wording alone to guarantee the response shape.
- Verified against a real generated resume: selecting `sec_experience` (2 entries, 9
  bullets total) returned exactly 9 updates, one per bullet, keyed by bullet id, no
  section/entry id in the output; selecting `sec_skills` (groups only, no entries)
  returned `{"updates": []}` with a 200; selecting `sec_education` (entries with no
  bullets) also returned `{"updates": []}` with a 200. Also re-verified bullet-level
  revision still returns exactly one update for exactly the selected bullet (regression
  check, unchanged behavior).

**2. Cover letter revision** (`app/services/llm.py`, `app/routes/revise.py`)
- New `COVER_LETTER_REVISE_SYSTEM_PROMPT` + `revise_cover_letter(cover_letter, selected_ids,
  instruction)`: simpler than the resume prompt since selected ids are always paragraph
  ids directly (no entry/section expansion needed) — same `MAX_INPUT_CHARS` instruction
  check, same `check_and_increment()` guard ordering as every other LLM-calling function,
  same `_normalize_revise_result()` defensive pass on the output.
- `/revise` route now branches: `req.cover_letter` present → `revise_cover_letter`;
  `req.resume` present → existing `revise_resume`; neither present → clean **400**
  (`"Request must include either 'resume' or 'cover_letter'."`) checked before either
  branch runs, so it can't be swallowed by the `ValueError`/`RuntimeError` handlers.
- Verified: generated a real cover letter, selected `p1`, submitted "make this more
  concise, one sentence" — response contained exactly one update for `p1`, untouched
  `p2`/`p3`; a request with neither `resume` nor `cover_letter` returned 400 as designed.

**3. Cover letter rendering** (`app/services/render.py`, `app/routes/render.py`,
`app/models.py`)
- `RenderRequest.resume` is now `Optional`; added `RenderRequest.cover_letter:
  Optional[CoverLetter] = None` (same shape as `ReviseRequest`).
- New `render_cover_letter_docx(cover_letter, output_path)`: right-aligned date (only
  emitted if `meta.date` is non-empty — matches `generate_cover_letter` always leaving it
  blank, so in practice no date line renders yet, which is correct, not a bug), a bold
  `Re: {role} at {company}` line when either is present, `"Dear Hiring Manager,"`, each
  paragraph as its own paragraph, `"Sincerely,"`, bold name, then an `email | phone`
  contact line. Same Calibri 10.5pt / 0.75in-margin setup as `render_resume_docx` (both
  now pull from the same style/margin block pattern).
- `/render` route branches the same way as `/revise` (cover_letter → cover letter render;
  resume → existing behavior; neither → 400) and derives the downloaded filename from
  whichever is present: `{name}_CoverLetter.docx`/`.pdf` vs `{name}_Resume.docx`/`.pdf`
  (previously hardcoded to `_Resume`).
- Verified: rendered a real generated cover letter to `.docx` — 200, correct
  `Content-Type`, `Content-Disposition: ...CoverLetter.docx`, and (via `python-docx`)
  confirmed the actual paragraph text, subject line, salutation, and sign-off all render
  correctly with no stray date line (since `meta.date` was empty). Also rendered the same
  cover letter to `.pdf` — 200, real 1-page PDF, `...CoverLetter.pdf` filename. Re-verified
  resume rendering is completely unchanged: `.docx` still names `{name}_Resume.docx`; an
  invalid `format` (`"txt"`) still returns a clean 400; a request with neither `resume`
  nor `cover_letter` returns 400. `GET /usage` was unaffected by any of the render calls
  above (still doesn't go through the usage guard, as before).

**All three tracked backend gaps are now closed.** The frontend session (`frontend-2c`)
has been notified so it can re-enable section-level selection in `ResumePreview.tsx`,
wire cover-letter revision into `handleRevise`/`RevisionChat`, and add a download control
for cover letters.

## Backend Part 2 — Save/retrieve generated resumes & cover letters (2026-09-12)

New `/resumes` endpoints (`app/routes/resumes.py`, registered in `app/main.py` alongside
`profile`/`generate`/`revise`/`render`) let a generated `Resume` or `CoverLetter` be saved
and retrieved later, independent of the frontend's Part 1 (tab persistence) work — built
in parallel against a shared contract, no coordination needed beyond keeping the API shape
exact.

- **Storage**: flat files, same pattern as `app/data/profile.json` — one JSON file per save
  at `app/data/saved_items/{uuid}.json`, containing `{id, name, type, created_at, data}`.
  The directory is created on first `POST` (`mkdir(parents=True, exist_ok=True)`) rather
  than needing to exist upfront; `GET /resumes` also tolerates the directory not existing
  yet (returns `[]` rather than erroring) for a totally fresh checkout.
- **Endpoints**:
  - `POST /resumes` — body `SaveRequest {name?, type, data}` → writes a new file with a
    fresh `uuid.uuid4()` id and `datetime.utcnow().isoformat()` `created_at`, returns the
    full `SavedItem`.
  - `GET /resumes` — returns all saved items but **only** `{id, name, type, created_at}`
    each (no `data`), sorted newest-first, so the list stays small regardless of how big
    the saved resumes/cover letters are.
  - `GET /resumes/{id}` — returns the full `SavedItem` including `data`.
  - `DELETE /resumes/{id}` — deletes the file, returns **204 No Content** (empty body;
    initially returned 200 + `{"deleted": id}`, tightened to match REST convention after
    manager review — verified via `curl -i` that the response is now a bare 204).
  - Missing/invalid `id` on `GET`/`DELETE /resumes/{id}` → clean **404**
    (`"Saved item not found"`) via `HTTPException`, not an unhandled exception.
- **Default name generation** (when `name` is omitted or an empty/whitespace string):
  - Cover letter: `"{company} — {role}"` if `meta.company` and `meta.role` are both
    non-empty; falls back to whichever one is present alone if only one is; falls back
    further to the universal fallback below if neither is present. (Resume has no
    equivalent `meta.company`/`role` fields, so resumes always fall through to the
    universal fallback — no fields were added to the `Resume` model for this.)
  - Universal fallback (all resumes; cover letters with neither company nor role):
    `"{Resume|Cover Letter} — {created_at as YYYY-MM-DD HH:mm}"`, e.g.
    `"Resume — 2026-09-12 22:10"`.
- **New models** (`app/models.py`): `SavedItem` (`id`, `name`, `type`, `created_at`,
  `data: dict` — deliberately loose/untyped since the caller already validated the shape
  once via `Resume`/`CoverLetter` before saving) and `SaveRequest` (`name: Optional[str]`,
  `type`, `data: dict`).
- Verified directly against the running server (`curl`, matching the plan's 6-step test
  script exactly): explicit-name save → file created, response matches; no-name resume
  save → `"Resume — 2026-09-12 22:10"`-style default; no-name cover letter save with both
  `company`/`role` → `"Acme Corp — Backend Engineer"`; no-name cover letter with only
  `company` (empty-string `name` in the request body, empty `role`) → `"Acme Corp"` alone,
  confirming the graceful partial-fallback; `GET /resumes` returned both items with only
  summary fields, newest-first; `GET /resumes/{id}` round-tripped the full `data` with an
  exact spot-check match on `summary.text`; `DELETE` removed the file and it no longer
  appeared in a subsequent `GET /resumes`; both `GET` and `DELETE` on a nonexistent id
  returned a clean 404. All test saves were deleted after verification — no leftover
  files in `app/data/saved_items/`.
- **Resolved**: `app/data/saved_items/` is now gitignored (root `.gitignore`) —
  `profile.json` remains the only tracked file under `app/data/`, since saved items are
  user-generated output rather than master data.

## Backend Part 3 — Summary revision verification, skill/link ids, skills-section revision (2026-09-15)

Picked up from a manager-session handoff: `/revise` never had summary-id revision
actually verified end-to-end (the prompt was written with it in mind, but no one had
curl'd it), and `sec_skills` selection was a documented no-op (`{"updates": []}`)
because skill groups hold `items: list[str]`, not bullets, and nothing in
`REVISE_SYSTEM_PROMPT` knew how to expand that. Also folded in prep for a longer-term
planned feature (inline manual editing of every rendered field, protected from later
broad chat revisions) by giving skill items and links stable per-item ids now, while
this code was already being touched — no manual-editing code itself, just the schema
groundwork so it isn't boxed out later.

**1. Summary-id revision — verified working, no fix needed.** Contrary to the
"never verified" starting assumption, curling `/revise` with a real saved resume
(`selected_ids: ["summary"]`, instruction "Make this punchier and mention cloud
infrastructure explicitly") returned exactly one update keyed by `"summary"` with
revised text that incorporated the instruction — no code change required for this part.
Re-verified again after all the schema/prompt changes below, using a freshly-`/generate`d
resume whose summary id was `"summary_r1"` (not the literal string `"summary"` — `/generate`
mints a fresh id per the existing "generate new unique ids for the summary" instruction in
`GENERATE_SYSTEM_PROMPT`), with `selected_ids` set to that resume's actual
`summary.id`: still exactly one update, correctly keyed by `"summary_r1"`, shortened to
one sentence as instructed. (Passing the literal string `"summary"` against a resume
whose real summary id was `"summary_r1"` also produced a correct single update keyed by
the resume's real id — the model reads `resume.summary.id` from the JSON rather than
echoing back whatever string was in `selected_ids` — but that's a lucky/smart model
behavior, not a contract to rely on; callers should always pass the resume's actual
current summary id, same as any other id.)

**2. Schema change — `SkillGroup.items` and `Link` now carry stable per-item ids**
(`app/models.py`):
- New `SkillItem` model: `{id: str, text: str}`. `SkillGroup.items` is now
  `list[SkillItem]` instead of `list[str]`.
- `Link` gained an `id: str` field alongside its existing `label`/`url`.
- `app/data/profile.json` migrated in place: all 42 skill items across the 9 groups got
  readable, group-scoped, globally-unique ids (e.g. `item_cloud_gcp`, `item_devops_docker`,
  `item_tools_github` — scoped by group prefix specifically so `item_github` couldn't
  collide between the DevOps group's "GitHub Actions CI/CD" and the Tools group's plain
  "GitHub", matching the existing convention of entry-scoped bullet ids like `b_salo_1`/
  `b_sc_1` avoiding cross-entry collisions). The 3 `meta.links` entries got
  `link_github`/`link_linkedin`/`link_website`. `GET /profile` was curled after the
  migration and validated cleanly against the new `Profile` model (200, correct nested
  `{id, text}`/`{id, label, url}` shapes) — confirms the hand-edited JSON round-trips
  through Pydantic validation correctly, not just that the file parses as JSON.
- `GENERATE_SYSTEM_PROMPT` (`app/services/llm.py`) updated: the schema example now shows
  `items` as `[{id, text}]` and `links` as `[{id, label, url}]`, with an explicit
  instruction to generate short readable unique ids for each and to reuse the profile's
  existing item/link ids when a skill item or link is carried over unchanged. Verified
  with a real `/generate` call (backend/cloud-focused JD): every emitted skill item and
  link came back as a proper `{id, text}`/`{id, label, url}` object (e.g.
  `{"id": "item_cloud_gcp", "text": "GCP (Cloud Run, Cloud SQL, GCS)"}`), and the whole
  response validated against `GenerateResponse`'s `Resume` model (FastAPI's
  `response_model` would have 500'd on a shape mismatch — it didn't).
- `app/services/render.py`: the skills-group docx line (`", ".join(group.get("items",
  []))`) was reading raw strings; changed to
  `", ".join(item.get("text", "") for item in group.get("items", []))`. Verified by
  rendering the `/generate`d resume above to `.docx` (200, real file) and opening it
  with `python-docx` to confirm the skills lines read as plain text
  (`"Backend: FastAPI (Python), Node.js, Express, TypeScript, REST APIs"`, etc.) — not
  Python dict reprs, which is what would show up if this read had been missed. Grepped
  the whole backend for other `.items`/`.links`/`"items"`/`"links"` usages
  (`app/routes/*.py`, `app/services/*.py`) — the only other reads are `meta.get("links")`
  in `render.py`'s contact line, which already reads `.get("label")`/`.get("url")` off
  each link dict and needed no change since those keys are unchanged. Did not touch old
  files under `app/data/saved_items/` (pre-existing test saves with the old bare-string
  `items` shape) — `SavedItem.data` is stored/returned as a loose `dict`, never validated
  against `Resume`, so those old files still round-trip through save/list/get/delete
  fine; only new saves going forward will carry the new shape. Not in scope for this pass
  (only `profile.json` was named for migration) and not worth cleaning up old throwaway
  test data.

**3. `REVISE_SYSTEM_PROMPT` — skill-group-level and whole-skills-section revision**
(`app/services/llm.py`), additive alongside the existing bullet/summary/entry/section
rules — no changes to `ReviseUpdate`/`ReviseResponse` (still the flat `{id, text}` pair):
- A skill group id (e.g. `skill_devops`) is now directly revisable: its current state is
  represented as its items' `.text` values joined with `", "`, the instruction is applied
  to that comma-separated string, and the model returns one `{id: group_id, text:
  "revised, comma, separated, items"}` update.
- A whole `sec_skills`-type section selection expands to one such update per group in
  that section (mirrors the existing entry→bullet and section→bullet expansion
  conventions, just group-level instead of bullet-level).
- Verified with curl against a `/generate`d resume:
  - **Single group** — `selected_ids: ["skill_devops"]`, instruction "Add Kubernetes to
    this list.": exactly one update, `{"id": "skill_devops", "text": "Docker, GitHub
    Actions CI/CD, Terraform, Linux, Kubernetes"}` — new item appended, nothing else
    touched.
  - **Whole section** — `selected_ids: ["sec_skills"]` on a resume with 6 skill groups,
    instruction "Make each list more concise, keep only the most job-relevant items.":
    exactly 6 updates, one per group id present (`skill_backend`, `skill_cloud`,
    `skill_devops`, `skill_databases`, `skill_testing`, `skill_tools`), each a trimmed
    comma-separated list — no group skipped, no extra ids invented.
  - **Combined multi-select regression** — `selected_ids` = [a no-bullet education entry
    id, a bullet id, a skill group id] in one request, instruction "Tighten the wording.":
    exactly 2 updates (bullet + skill group), the no-bullet education entry correctly
    produced nothing — confirms the new group-expansion logic doesn't interfere with the
    existing entry-with-no-bullets skip rule when both are selected together.
- **Regression-checked, all still correct after the prompt rewrite**: bullet-level single
  id (1 update), entry-level id (6 updates, matching that entry's actual bullet count),
  section-level id for `sec_experience` (9 updates, matching the section's total bullet
  count across both its entries), and cover-letter paragraph revision (`selected_ids:
  ["p1"]` on a saved cover letter → exactly 1 update for `p1`, others untouched).

**Design decision (already made by the requesting session, not reopened here)**: when a
skill group is revised, item ids inside that group's new list are not preserved — the
frontend regenerates fresh ids for whatever list comes back, the same way bullet ids
already get regenerated wholesale on every fresh `/generate`. This backend pass only
needed to produce the revised comma-separated text per group; it does not mint or return
per-item ids in the revise response at all (the response is still just `{id: group_id,
text: "..."}`), so there was nothing further to implement here for that decision — it's
a frontend-side concern when it applies the update.

**Future direction (not built yet, just noted so the schema choices above read as
intentional)**: there's a longer-term plan to add inline manual editing to every
rendered field (bullets, summary, skill items, links, cover-letter salutation, etc.),
with manual edits meant to survive/be protected from later broader chat-scoped
revisions. No code for that exists yet. The `SkillItem`/`Link` id fields added in this
pass are deliberate prep for it — giving every eventually-editable atom a stable
identity now — rather than a scope-creep addition; nothing in this pass implements
manual editing or edit-protection itself. **Superseded 2026-09-16, see Backend Part 4
below**: the rest of the id inventory (meta fields, entry fields, cover letter meta,
salutation/sign-off) was completed in that pass — the only remaining gap is
`Section.title`, explicitly deferred, not an oversight.

**Frontend note**: `frontend-69` is waiting on the schema change (task 2) and the new
skill-group/section revise support (task 3) landing before it can build the
skills-selection UI against the new `{id, text}` item shape. Both are now live in
`main`/working tree on the backend side as of this pass.

**Follow-up same day, 2026-09-15/16 — pre-existing saved items had the old shape, fixed:**
A real user hit a 422 in the browser reviving/rendering a saved resume, caused by the one
pre-existing resume save under `app/data/saved_items/` (`18bd446c-...json`, saved before
this pass) still holding the old shape — bare-string skill items and links with no `id`.
Migrated it in place with the same convention used for `profile.json` (group-scoped item
ids reusing that file's own group-id prefix, e.g. `sg_backend` → `item_backend_python`,
`item_backend_fastapi`, `item_backend_pydantic`; `link_github`/`link_linkedin` for its 2
links). The other saved file (`fe524a44-...json`, a cover letter) has no `links` or
`skills` field at all, so nothing to migrate there — checked directly, not assumed.
Reproduced the exact failure first to confirm root cause before fixing: POSTing the old
(pre-migration) shape straight to `/render` returned a 422 with the identical error shape
the user hit (`missing` on `meta.links[0].id`, `model_attributes_type` on each bare-string
skill item) — then confirmed the migrated file's data now returns 200 from both `/render`
and `/revise` (curled a skill-group revise against its `sg_backend` group — `sg_` prefix,
not `skill_`, confirming the group-expansion logic isn't hardcoded to profile.json's
`skill_` id prefix).
**Confirmed, not assumed, re: ongoing risk**: `POST /resumes` (`app/routes/resumes.py`)
takes `SaveRequest.data: dict` — genuinely untyped, no Pydantic validation against
`Resume`/`CoverLetter` at all, by design (the loose-dict comment on `SavedItem.data` is
accurate). Proved this isn't just a theoretical gap by POSTing a synthetic old-shape
payload (bare-string items, link with no id) directly to `/resumes`: it saved with a
plain 200, no rejection, no coercion — then deleted that probe row via `DELETE
/resumes/{id}` to leave no test data behind. So: correctness of what lands in
`saved_items/` depends entirely on whatever the frontend sends in `data` being well-formed
at write time — there is no backend-side gate that would catch a regression. Checked (not
just taken on trust) whether today's frontend actually sends the new shape: read
`frontend/app/components/SaveButton.tsx` — it POSTs `{ name, type, data: doc }` where
`doc: Resume | CoverLetter` (typed, not `any`) — and `frontend/app/types.ts`, whose
`SkillItem`/`SkillGroup.items`/`Meta.links` types already match the new `{id, text}`/
`{id, label, url}` backend shapes exactly. So this is genuinely just cleanup of the one
pre-existing file, not an active bug on the frontend's current save path. It's still a
standing soft spot at the type-system boundary, though: nothing stops a future frontend
change (or a raw curl to `/resumes`) from writing malformed `data` again, since
`SaveRequest`/`SavedItem` don't validate it — worth keeping in mind if `/resumes`'s save
path is touched again, not something this fix closes off structurally.

## Backend Part 4 — Full field-level id inventory: meta, entry fields, cover letter salutation/sign-off (2026-09-16)

Groundwork pass ahead of a planned inline-manual-editing UI covering every rendered
field, not just bullets/summary/skills (which Part 3 already covered). Every remaining
editable unit gets a stable `{id, text}` id now, same pattern as `SkillItem`/`Link`, so
the schema isn't boxed out later. Two decisions were made by the requesting session going
in, not relitigated here: meta fields get synthetic ids (uniform id-based mechanism
everywhere, no path-based addressing like `"meta.name"`), and cover letter
salutation/sign-off become real schema fields now (previously hardcoded strings in the
frontend template with zero backend representation). `Section.title` is explicitly out
of scope/deferred, per instruction — not touched.

**1. Schema (`app/models.py`)** — new generic `IdText {id, text}` model, used for:
- `Meta.name` / `.email` / `.phone` (ids always exactly `meta_name`/`meta_email`/
  `meta_phone` — there's only one `meta` per resume, no scoping needed).
- `Entry.title` / `.organization` / `.location` / `.dates` (ids suffix that entry's own
  id: `<entry_id>_title`, `_org`, `_location`, `_dates` — e.g. `entry_salolabs_title`).
- `CoverLetterMeta.name` / `.email` / `.phone` / `.date` / `.company` / `.role` (ids
  `cl_meta_name`/`cl_meta_email`/`cl_meta_phone`/`cl_meta_date`/`cl_meta_company`/
  `cl_meta_role`).
- New `CoverLetter.salutation: IdText` / `.sign_off: IdText` fields (didn't exist at all
  before), with defaults `{id: "cl_salutation", text: "Dear Hiring Manager,"}` /
  `{id: "cl_sign_off", text: "Sincerely,"}` matching prior hardcoded frontend behavior.
  Verified pydantic v2 deep-copies `BaseModel`-instance field defaults per model
  instance (not shared/mutated across instances) before relying on this pattern.
- `SkillItem` redefined as `class SkillItem(IdText): pass` (was a separate duplicate
  `{id, text}` definition) — pure dedup, no behavior change, not requested but free
  given `IdText` already exists with the identical shape.
- `Entry.location`/`.dates` are still allowed empty `text` (several profile entries have
  blank location or dates, e.g. the personal-project entries) — only the field's
  *presence* as an object is now required, not non-empty text.

**2. `app/data/profile.json` migrated** — `meta.name/email/phone` and every entry's
`title/organization/location/dates` across all 17 entries (6 experience, 4 projects, 1
education, 6 certifications) converted to `{id, text}`, ids following the conventions
above. Verified two ways: `GET /profile` returned 200 with correctly nested shapes, and
(stronger check) loaded the file and constructed `Profile(**data)` directly in Python —
validates cleanly end to end, not just "the route didn't 500."

**3. `GENERATE_SYSTEM_PROMPT` and `COVER_LETTER_SYSTEM_PROMPT` (`app/services/llm.py`)**
updated with the new nested `{id, text}` shapes and the id-naming convention spelled out
explicitly (including reusing the profile's existing ids when a value carries over
unchanged, same convention as the Part 3 skill-item/link ids). Verified with two real
`/generate` calls:
- **Resume** — a backend/cloud JD produced a resume whose `meta.name/email/phone` and
  every entry's `title/organization/location/dates` came back as correctly-shaped
  `{id, text}` objects with the exact conventioned ids (e.g.
  `entry_salolabs_location` → `{"id": "entry_salolabs_location", "text": "Austin, TX"}`),
  and the whole response validated against `GenerateResponse`'s `Resume` model (FastAPI
  would 500 on a shape mismatch — it returned 200).
- **Cover letter** — a JD that explicitly named a hiring manager ("address your
  application to Jane Smith") produced a cover letter with all 6 `cl_meta_*` fields
  correctly shaped, and — notably — `salutation: {"id": "cl_salutation", "text": "Dear
  Jane Smith,"}`, confirming the model actually follows the new "address by name when
  the JD gives one" instruction rather than always falling back to the generic default.
  `sign_off` came back as the expected `{"id": "cl_sign_off", "text": "Sincerely,"}`
  default. Full response validated against `CoverLetter`.

**4. `app/services/render.py`** — new `_t(id_text)` helper (`(id_text or {}).get("text",
"")`) used everywhere the renderer previously read these fields as bare strings: resume
meta name/email/phone, every entry's title/organization/location/dates (both the
experience/projects header path and the education/certifications single-line path), and
cover letter meta date/role/company/name/email/phone. The cover letter's salutation/
sign-off paragraphs now read `_t(cover_letter.get("salutation"))` /
`_t(cover_letter.get("sign_off"))` instead of the old hardcoded `"Dear Hiring Manager,"`
/ `"Sincerely,"` literals (kept as an `or` fallback in case either is ever blank).
Verified by rendering both the resume and cover letter from step 3 to `.docx` and reading
the actual paragraph text back out with `python-docx`: name/contact/entry lines all read
as plain text (not dict reprs), and the cover letter's rendered salutation line was
literally `"Dear Jane Smith,"` — sourced from the schema field, not a hardcoded literal.
- **Two real bugs found and fixed while verifying, both because grep alone had missed
  them the first time** (a plain `.get("name")` grep doesn't match `.get("name", "X")` —
  worth remembering next time a similar migration touches this file structure):
  - `app/routes/render.py`: `data.get("meta", {}).get("name", doc_label).replace(" ",
    "_")` (used to build the download filename) crashed with `AttributeError: 'dict'
    object has no attribute 'replace'` once `meta.name` became an object — both the
    resume and cover-letter render calls 500'd on first attempt. Fixed to unwrap
    `.get("text")` from the name object before calling `.replace`.
  - `app/routes/resumes.py`'s `_default_name()`: `(meta.get("company") or "").strip()` /
    same for `role` — would have crashed the same way the moment a caller saved a cover
    letter without an explicit name. Fixed to read `.get("text")` off the company/role
    objects first. Verified by POSTing a real generated cover letter to `/resumes` with
    no `name` field: got back a correctly-derived default name ("Acme Corp — Backend
    Engineer"), no crash — then deleted the probe row via `DELETE /resumes/{id}`.
  - Re-grepped the whole backend afterward with a looser pattern (not requiring an exact
    closing paren after the key) to check for any other misses — none found; the only
    remaining bare-string read is `section.get("title", "")` in `render.py`, which is
    correct as-is since `Section.title` is the one field intentionally left untouched
    this pass.

**5. `REVISE_SYSTEM_PROMPT` and `COVER_LETTER_REVISE_SYSTEM_PROMPT`** extended so the new
ids are directly revisable as plain single-string fields (no comma-joining, unlike skill
groups) — meta field ids, link ids, and entry field ids for resumes; `cl_meta_*`,
`cl_salutation`, `cl_sign_off` for cover letters. Additive only; existing bullet/summary/
entry/section/skill-group/paragraph rules untouched.

**6. Verified with curl (real output, not assumed)**:
- **Entry field revision** — selected `entry_salolabs_location`, instruction "Just say
  Austin, Texas (spell out the state)": exactly one update, `{"id":
  "entry_salolabs_location", "text": "Austin, Texas"}`.
- **Cover letter salutation revision** — selected `cl_salutation` on the Jane-Smith
  letter from step 3, instruction "I don't actually know the hiring manager's name,
  revert to a generic greeting": exactly one update, `{"id": "cl_salutation", "text":
  "Dear Hiring Manager,"}`.
- **Combined multi-select** — selected an entry's `dates` id, a bullet id, a skill group
  id, and `meta_email` together in one request, instruction "Tighten wording": exactly 4
  updates, one per selected id, each independently and correctly revised (the email was
  correctly left essentially unchanged — nothing to tighten in an email address, no
  hallucinated edit).
- **Full regression pass, all still correct**: bullet-level (1 update), entry-level (5
  updates, matching that entry's actual bullet count), section-level `sec_experience` (7
  updates, matching the section's total bullet count), summary-id (1 update, correctly
  keyed to that resume's actual `summary_r1` id), skill-group-id (1 update, Kubernetes
  appended), and cover-letter paragraph-id (1 update for `p1`, others untouched).

**7. Saved-items follow-up** — while verifying, checked whether the two pre-existing
files under `app/data/saved_items/` (the same ones fixed for the item/link shape in
Part 3's follow-up) also had old-shape meta/entry fields. They did — same bug class that
already caused a real user-facing 422 once. Migrated both proactively, same convention:
`18bd446c-...json` (resume) got `meta.name/email/phone` and its one entry's
`title/organization/location/dates` converted (note: this file's entry id is
`ent_salolabs`, not `entry_salolabs` — its own prefix, correctly reused, e.g.
`ent_salolabs_location`); `fe524a44-...json` (cover letter) got its 6 meta fields
converted plus new `salutation`/`sign_off` fields added (it had neither before — the
`CoverLetter` model's field didn't exist yet when that file was saved). Verified both via
`GET /resumes/{id}` (200, correct shapes), then round-tripped each through `/render`
(200, real docx) and `/revise` (the resume's `ent_salolabs_location` id: one correct
update, `{"id": "ent_salolabs_location", "text": "Remote"}`) — confirms the id-naming
logic isn't hardcoded to `profile.json`'s specific prefixes.

**Frontend note**: `frontend-69` needs this id-naming convention and final schema shape
to update its types and rendering — not new UI work for them yet either, just making
sure nothing breaks when `meta`/entry fields become objects instead of strings, the same
way Part 3's skill-item shape change required a types.ts update.

## Backend Part 5 — Automated test suite (2026-09-16)

**Why**: manual curl/browser verification was the only regression net (it's how the
`max_tokens` truncation bug got caught, but only because that area happened to get
touched again). With Claude-in-Chrome eventually driving this API programmatically and
unattended, contract regressions need to fail a test run, not wait for someone to notice.
Frontend stays manual-only (a separate, already-made decision) — this is backend-only.

**Structure**: `backend/tests/`, pytest + FastAPI's `TestClient`. `pytest.ini` sets
`pythonpath = .` and registers two markers, both excluded by default via
`addopts = -m "not live and not slow"`:
- `live` — hits the real Anthropic API (real token spend, non-deterministic output).
- `slow` — the PDF-conversion test (~10s, LibreOffice cold-start).

**Run it**:
- `pytest` — the default, safe suite. No network calls, no token spend, deterministic.
  30 tests, runs in under a second.
- `pytest -m slow` — the PDF conversion test (needs LibreOffice installed).
- `pytest -m live` — 3 real-LLM smoke tests (generate resume, generate cover letter,
  revise) against the actual API. Costs real tokens; run deliberately, not in CI.

**How the Anthropic client is mocked**: `tests/conftest.py` has an autouse
`block_real_llm_calls` fixture that replaces `client.messages.create` with a function
that raises `AssertionError` for any test not marked `@pytest.mark.live` — a safety net
so a test that forgets to mock its LLM call fails loudly instead of silently hitting the
network. Tests that need a canned model response request the `mock_llm` fixture instead,
which overrides that guard with a fake response built from whatever JSON text is passed
in. `/render` needs no mocking (pure `python-docx` templating, no LLM call).

**Isolation from real data**: `tmp_saved_items` monkeypatches `resumes.DATA_DIR` to a
pytest tmp dir; `tmp_profile_path` monkeypatches both `profile.DATA_PATH` and
`generate.DATA_PATH` to a scratch `profile.json` seeded from a `minimal_profile` fixture.
No test reads or writes the real `app/data/` contents.

**Coverage**: `/generate` (both types' success shape, unknown-type 400, malformed-JSON
502, exhausted-usage-guard 429, oversized job_description/company_context 502);
`/revise` (neither-resume-nor-cover_letter 400, both types' success shape, 502/429 paths,
oversized-instruction 502, and `_normalize_revise_result`'s bare-`{}`-to-`{"updates":[]}`
fix). Note on id-expansion: there's no backend expansion logic to unit-test — an
entry/section/skill-group id "expanding" into multiple bullet updates is entirely
prompt-driven model behavior, so the mocked tests only verify the route relays whatever
`updates` the model returns, unfiltered; `/render` (real docx generation for both types,
text-content-verified via `python-docx`, plus the format/missing-payload 400s, PDF gated
behind `slow`); `/resumes` (create/get/list/delete round-trip against a temp dir, 404s);
`/profile`, `/health`, `/usage` (sanity checks).

**Verified the suite has actual teeth, not just green-by-construction**: temporarily
removed the `result.setdefault("updates", [])` line from `_normalize_revise_result` —
`test_revise_normalizes_bare_object_to_empty_updates` failed immediately (FastAPI's
response-model validation rejected the bare `{}}`), confirming the mocked suite catches a
real contract regression. Separately, re-tested the actual `max_tokens` story: reverting
to the old `4096` and hitting the live `/generate` endpoint didn't reliably reproduce a
truncation (model output length varies call to call — one run at `4096` came back fine),
so as a sharper demonstration `max_tokens` was dropped to an obviously-too-small `300` and
`pytest -m live tests/test_live.py::test_live_generate_resume` failed with a 502 exactly
as expected. Reverted both changes immediately after; `git diff` against the last commit
came back empty and the full default suite was re-confirmed green (30 passed).

**Added to `requirements.txt`** (test-only): `pytest==8.3.3`, `httpx==0.27.2` (needed by
`starlette.testclient.TestClient` — note this project's `anthropic` SDK actually pulls in
a *different* package called `httpx2`, not `httpx`, so this was a genuinely new
dependency, not already satisfied transitively).

## Backend Part 6 — `cleaned_job_description` field (2026-09-16, UI redesign Phase 1)

**Context**: first backend piece of the two-tab (Generate/Saved) redesign being planned
with the user (full scope in `TODO.md`'s "Planned features" section). Users typically
paste an entire scraped webpage as the job description — nav links, "Apply Now" buttons,
cookie banners, application-form fields, EEO survey questions, footer boilerplate — mixed
in with the actual posting. Since the model already has to read the whole thing to
tailor content, it now also returns a cleaned version in the same call, at no extra API
cost. This is Phase 1 only — the bigger `/applications` package-storage work (Phase 3 in
the redesign) is separate and not started.

**What changed**:
- `GenerateResponse` (`app/models.py`) gains `cleaned_job_description: Optional[str] = None`.
- Both `GENERATE_SYSTEM_PROMPT` and `COVER_LETTER_SYSTEM_PROMPT` (`app/services/llm.py`)
  now instruct the model to also return a `"cleaned_job_description"` field alongside the
  resume/cover-letter JSON it was already producing — same JSON object, one extra
  top-level key. Explicitly framed as cleanup, not summarization: "keeping all the
  substantive content ... in its original wording."
- `app/routes/generate.py` pops that key off the parsed result dict before assigning the
  rest to `resume`/`cover_letter`, so it surfaces at the top level of the response and
  never leaks into the nested `Resume`/`CoverLetter` object. Defaults to `None` via
  `dict.pop(..., None)` if the model ever omits it, so an older-shaped response can't crash
  response-model validation.

**Verified against a real scraped page**, not just clean sample text: pulled the actual
rendered DOM text (`document.body.innerText`, not `get_page_text`'s already-cleaned
article extraction) from a live Greenhouse job posting
(`job-boards.greenhouse.io/justworks/jobs/6917404`) via Claude-in-Chrome — 10,984 raw
characters including "Back to jobs", the "Apply" button, the entire application form
(First Name/Last Name/Resume attach/Dropbox/Google Drive), the full EEO/demographic
survey block, and footer boilerplate. Posted that raw text through `/generate`
(`type: "resume"`): `cleaned_job_description` came back at 5,040 characters — all of the
above stripped, all substantive content preserved (Who We Are, Who You Are,
responsibilities, competencies/values, qualifications, tech stack, salary range) in its
original wording, not leaked into the `resume` object. Repeated with a smaller synthetic
junk sample (`type: "cover_letter"`) — same clean strip ("Apply Now", cookie banner,
footer copyright all removed; substance intact), confirming both generation types work.

**Test coverage** (`tests/test_generate.py`, mocked): resume/cover-letter success cases
now assert `cleaned_job_description` surfaces at the top level and isn't nested inside
`resume`/`cover_letter`; a third test confirms a model response that omits the field
comes back as `null` instead of crashing. Full suite: 31 passed (was 30).

## Backend Part 7 — Job application packages, `/applications` replaces `/resumes` (2026-09-17, UI redesign Phase 3)

**Context**: bigger backend piece of the UI redesign (full scope in `TODO.md`'s "Planned
features" section). The old `/resumes` save model saved one document at a time with no
JD attached and no link between a resume and its paired cover letter — doesn't fit the
new Saved-tab design, which needs one package per job with pills for whichever of
JD/Resume/CL exist. No migration: existing `app/data/saved_items/` entries were confirmed
disposable by the user, nothing carried over. `/resumes` is removed entirely, not kept
alongside `/applications` — `app/routes/resumes.py` and `tests/test_resumes.py` deleted,
`SavedItem`/`SaveRequest` removed from `app/models.py`.

**New model** (`app/models.py`): `JobDescription {raw: str, cleaned: Optional[str]}`,
`Application {id, name, created_at, job_description: JobDescription, resume:
Optional[Resume], cover_letter: Optional[CoverLetter]}`, `ApplicationSummary {id, name,
created_at, has_resume: bool, has_cover_letter: bool}` (the list-view shape — frontend
needs the two booleans to know which pills to render on a Saved-tab card, not the full
nested data), `CreateApplicationRequest {name: Optional[str], job_description:
JobDescription, resume: Optional[Resume], cover_letter: Optional[CoverLetter]}`. This
closes the known soft spot noted in `TODO.md` about `/resumes`'s `SaveRequest.data` being
an unvalidated loose `dict` — resume/cover_letter are real typed fields now, validated by
FastAPI before the route body ever runs.

**Storage** (`app/routes/applications.py`, new): one folder per package at
`backend/app/data/applications/{id}/` (gitignored, same pattern as the old
`saved_items/` — `.gitignore` updated), containing real separately-openable files rather
than one opaque blob: `job_description.txt` (raw), `job_description_cleaned.txt` (only
written if a cleaned version was provided), `resume.json` / `cover_letter.json` (only
whichever exist), `resume.docx` / `cover_letter.docx` (rendered at save time via the
existing `render_resume_docx`/`render_cover_letter_docx` — this is what makes a package
reviewable by opening files directly, per the original design goal), and `meta.json`
(`{id, name, created_at}`, the source of truth `GET /applications` reads without touching
the heavier JSON/docx files). **PDF snapshots were skipped** — docx alone is a real
openable file and avoids paying the ~10-22s LibreOffice cold-start cost documented above
on every single save; can add later if a package-level "download PDF" turns out to be
wanted beyond the existing on-demand `/render?format=pdf`.

**Endpoints**, mirroring `/resumes`'s conventions:
- `POST /applications` — body is `CreateApplicationRequest`. Derives a default name the
  same way `/resumes` did (company + role from the cover letter's meta if present, else
  company alone, else role alone, else an `"Application — <timestamp>"` fallback) unless
  `name` is given explicitly. Renders + writes all snapshot files, returns the full
  `Application`. Wraps the write/render steps in try/except that `shutil.rmtree`s the
  partial folder and returns 500 on failure (mirrors `/render`'s existing error-handling
  pattern) — no half-written package left behind if docx rendering fails partway through.
- `GET /applications` — list of `ApplicationSummary` only (id/name/created_at/pill
  flags), sorted newest-first. Only reads `meta.json` per folder plus two `.exists()`
  checks — doesn't touch resume.json/cover_letter.json/docx at all, so listing stays
  cheap regardless of package count.
- `GET /applications/{id}` — full `Application` (JD raw+cleaned, resume JSON, cover
  letter JSON) — enough to hydrate all three Generate sub-tabs on load. 404 if
  `meta.json` doesn't exist for that id.
- `DELETE /applications/{id}` — 204, `shutil.rmtree`s the whole folder. 404 if missing.

**Test coverage** (`tests/test_applications.py`, new, 10 tests, no LLM involved so fully
mocked-suite-speed): JD+resume-only create (and the resulting on-disk files), all-three
create (default name from cover letter meta), explicit-name override, JD-only create
(no resume/cover_letter files written), **real docx snapshots opened and text-verified
via `python-docx`** (not just "file exists"), list summaries' pill-flag correctness and
lightweight shape, full get round-trip, 404s on missing id for both get and delete, and
delete actually removing the folder from disk (checked via `Path.exists()`, not just the
204 status code). `tests/conftest.py`'s `tmp_saved_items` fixture replaced with
`tmp_applications` (same monkeypatch-the-route's-`DATA_DIR` pattern, pointed at the new
module). Full suite: 34 passed (was 31).

**Manually verified against the live server** (not just the mocked suite): generated a
real resume via `/generate`, packaged it via `POST /applications` (JD+resume only) —
200, folder created with `job_description.txt`/`job_description_cleaned.txt`/
`resume.json`/`resume.docx`/`meta.json`, `resume.docx` confirmed as real `Microsoft
OOXML` (via `file`) with correct extracted text (name, contact info, summary) via
`python-docx`. `GET /applications` showed it with correct pill flags, `GET
/applications/{id}` round-tripped correctly, `DELETE` returned 204 and the folder was
verified gone from disk via `ls`, followed by a 404 on a subsequent `GET`. Repeated with
a real resume + real cover letter together: default name correctly fell back to the
cover letter's role (`"Software Engineer"`, company was blank in this test JD), both
`resume.docx` and `cover_letter.docx` rendered as real openable files with correct
content. Confirmed `/resumes` is gone from the live route table (`GET /openapi.json`)
and `/applications` is live. Test data cleaned up afterward — real
`app/data/applications/` is empty again.

**Not migrated / left as-is**: the two leftover files in `app/data/saved_items/` from
earlier manual testing were left on disk rather than deleted — they're inert now (no
route reads that directory anymore, and it stays gitignored) and deleting them wasn't
necessary to ship this, so it seemed better to leave that as an explicit manual cleanup
step for whoever wants it gone rather than a silent side effect of this pass.

## Backend Part 8 — `PUT /applications/{id}`, update a package in place (2026-09-17)

**Why**: the Save button needs to update the currently-loaded package rather than always
creating a new one — e.g. revise a bullet, then re-save into the same package instead of
spawning a duplicate.

**Contract**: same request body as `POST /applications`
(`{name?, job_description: {raw, cleaned?}, resume?, cover_letter?}`). Overwrites
`job_description.txt`/`job_description_cleaned.txt`, `resume.json`/`cover_letter.json`,
and re-renders whichever `.docx` snapshot(s) are present, in place. `created_at` is
preserved from the original package; added a new `updated_at` field to the `Application`
model (always present — set equal to `created_at` on `POST`, bumped on every `PUT`) so
the frontend can tell a package has been touched since creation. **A `null` field is
treated as "this no longer exists in the session" and deletes the corresponding
file(s)** (e.g. omitting `cover_letter` on a package that has one removes
`cover_letter.json`/`cover_letter.docx`) — the frontend always sends full current session
state, so `null` is a real signal, not "leave unchanged." 404 if the id doesn't exist.
Not atomic (a failure partway through can leave some files updated and others not) —
acceptable for a local single-user tool; unlike `POST`, a failed `PUT` does **not**
delete the folder, since that would destroy the previous good state rather than just
failing to apply the new one.

**Test coverage** (`tests/test_applications.py`, +3 tests, 13 total in this file):
content replacement reflected in both the response and on-disk files (job description
text, resume JSON, and the re-rendered docx — checked by extracting text via
`python-docx` and confirming the *old* bullet text is gone, not just that the new text is
present), `created_at` preserved / `updated_at` changed, a subsequent `GET` matching the
`PUT` response exactly, a `null` field deleting the corresponding JSON+docx files, and a
404 on a nonexistent id. Full suite: 37 passed (was 34).

**Manually verified against the live server** on the real "Justworks — Software
Engineer" package from the Phase 3 dogfooding pass (left in place, not a throwaway):
pulled its current resume, ran a real `/revise` call on the first bullet ("make this
punchier and quantify impact"), applied the returned text, and `PUT` the updated resume
back into the same package. Confirmed: `created_at` unchanged, `updated_at` changed,
`GET /applications/{id}` afterward matched the `PUT` response exactly, and — opened
directly with `python-docx` — `resume.docx` on disk contains the new bullet text and no
longer contains the old bullet text. Backward-compat check: the pre-existing package
(created before this change, so its `meta.json` had no `updated_at` key) correctly fell
back to `updated_at == created_at` on `GET` rather than erroring.

## Backend Part 9 — `/revise` gets job description context, `company_context` renamed to `additional_context`, and a real `_extract_json` robustness fix (2026-09-17)

**1. `/revise` now receives the job description.** Root cause of a real user-hit bug:
`/revise` never sent the job description to the model at all (original design — early
revision instructions didn't need it), so an instruction like "remove skill groups that
don't add value for this job description" made the model correctly say in prose that it
lacked context, which broke JSON parsing and surfaced as a 502.
- `ReviseRequest` (`app/models.py`) gains `job_description: Optional[str] = None`.
- `revise_resume`/`revise_cover_letter` (`app/services/llm.py`) take a new
  `job_description` parameter, forwarded from `app/routes/revise.py`, included in the
  user message only when present (with the same `MAX_INPUT_CHARS` guard as everywhere
  else user text enters a prompt).
- `REVISE_SYSTEM_PROMPT`/`COVER_LETTER_REVISE_SYSTEM_PROMPT` now explain: use the job
  description only when the instruction itself references the job/role/requirements/
  company; otherwise ignore it and behave exactly as before — explicitly calling out that
  a plain instruction like "make this more concise" means the same thing either way, so
  this doesn't regress non-job-aware instructions. Frontend will always send it going
  forward (decided, not opt-in).

**2. `company_context` renamed to `additional_context`**, backend-wide — clean rename,
no backward-compat shim (local single-user tool, no other consumers).
`GenerateRequest.company_context` → `additional_context`; same rename through
`generate_resume`/`generate_cover_letter`'s parameters, the `"ADDITIONAL COMPANY/ROLE
CONTEXT:"` prompt label (now `"ADDITIONAL CONTEXT:"`), and the route. Not just a rename —
**broadened what the field means to the model**: previously framed narrowly as
company-specific tone/flavor, `GENERATE_SYSTEM_PROMPT`/`COVER_LETTER_SYSTEM_PROMPT` now
frame it as genuinely open-ended (company info, the candidate's relationship to the
company, additional qualifications not captured in `profile.json`, or any other free-form
context) and instruct the model to use qualification-type content *substantively* —
woven into a bullet/summary/paragraph the same as profile content would be — not just as
flavor. Explicitly carved out as an exception to the existing "don't fabricate" rule,
mirroring the same pattern already used in `REVISE_SYSTEM_PROMPT` for user-supplied new
skills.

**3. Found and fixed a real `_extract_json` bug while manually verifying #1.** Reproduced
the user's exact failing case against a real multi-skill-group resume ("remove skill
groups that don't add value for this job description") — the 502 was gone (confirming
the JD-wiring fix worked, the model correctly reasoned about which groups to drop), but a
*different* 502 appeared: the model sometimes prefaces its JSON with prose reasoning
before a fenced code block despite being told "no preamble" — more likely for
reasoning-heavy instructions like this one — and `_extract_json` only ever stripped a
fence if the response *started* with one. Fixed by making fence-detection search the
whole response (`re.search` for a ``` block anywhere) with a further fallback to the
outermost `{...}` if no fence is found at all. Verified deterministically with 6 new unit
tests in `tests/test_extract_json.py` (plain JSON, fenced-at-start, fenced-without-
language-tag, prose-before-fence — the regression case, bare-object-in-prose-no-fence,
and confirming genuinely non-JSON text still raises cleanly) rather than relying on
reproducing flaky live model behavior. Then reproduced the original live failing case
again post-fix: 200, correct groups removed based on JD relevance.

**Observation, not fixed (out of scope for this pass)**: the model represented "remove
this skill group entirely" as an update with empty `text` rather than omitting it — the
`/revise` response schema has no concept of deleting a whole group (a group update is
always `{id, text}`), so there's no clean way for the model to signal deletion within the
existing contract. Whether the frontend should treat an empty-text skill-group update as
"remove this pill" is a product/contract decision, not something this pass should
silently redesign — flagging for a follow-up if it comes up again.

**Test coverage**: `test_generate.py` +1 (confirms `additional_context` is forwarded to
the model under its new name, not silently dropped), `test_revise.py` +3 (oversized
`job_description` guard, `job_description` forwarded when present, and *not* injected
into the prompt when absent — the no-regression check), `test_extract_json.py` new, 6
tests. Full suite: 47 passed (was 37).

**Manually verified against the live server**, both pieces:
- `/revise`: reproduced the user's exact failing instruction against a real multi-group
  resume (the "Justworks" dogfood package's skill section) with a real fintech/Python/AWS
  job description — 200, four relevant skill groups kept and rewritten, Frontend/Tools
  groups correctly zeroed out as not relevant.
- `/generate`: a real resume generation with `additional_context` naming a HashiCorp
  Terraform certification not present in `profile.json` — the certification showed up
  woven into the summary, not just mentioned in passing. Cover letter generation with the
  same context (plus "I know one of the founding engineers from a meetup") wove the
  relationship into the opening paragraph and the certification into a body paragraph.

## Not yet built (explicitly deferred so far)

1. **Next.js frontend** — All 6 phases complete (connectivity, generate view, styled
   preview + selection, chat-scoped revision, cover letter mode, download). See above and
   `frontend/STATUS_FRONTEND.md` for details.
2. **Cloudflare Tunnel** — stable hostname to expose the local backend to the
   Vercel-hosted frontend. Not started.

## Open questions worth strategizing on

- **Everything in the original plan is now complete**, confirmed 2026-09-12 by the
  frontend session (`frontend-2c`) after its own end-to-end browser verification:
  `/generate`, `/revise`, and `/render` all support both resumes and cover letters
  (generate, revise — including section-level resume revision — and render/download),
  alongside `/profile` and the usage guardrails; the frontend covers connectivity,
  generate, styled preview + selection (all three levels, including sections), chat-scoped
  revision for both resumes and cover letters, cover letter mode, and download for both
  document types. `frontend-2c` reported: section-level selection re-enabled (tested a
  2-entry/9-bullet section revise, all 9 updated correctly), cover letter revision wired
  up (single-paragraph revise confirmed), and cover letter download added (docx + pdf both
  200, real downloads) — no contract mismatches on either side. **Superseded 2026-09-15**:
  this turned out to be incomplete — summary-id revision had never actually been curled
  end-to-end (it happened to work, verified in the Backend Part 3 section above, but
  "complete" shouldn't have been claimed without checking), and `sec_skills` selection was
  a silent no-op the whole time. Both are now fixed/verified; see Backend Part 3 above.
  Lesson for future status updates: "no open gaps" claims should be backed by an explicit
  check of every previously-listed capability, not just the ones touched in that pass.
- Frontend (`frontend-69`) still needs to build the skills-group/skills-section selection
  UI against the new `{id, text}` skill-item shape (Backend Part 3) — the backend side of
  that is done, this is a frontend follow-up, not a backend gap.
- The only backend-complete remaining work is the Cloudflare Tunnel + Vercel deployment
  infrastructure pass — not a feature gap, just deployment plumbing.
- Whether to bump `MAX_INPUT_CHARS` or `DAILY_CALL_LIMIT` once real usage patterns are
  known (e.g. a very long job posting, or heavier revise-loop iteration during editing).
