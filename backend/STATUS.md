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
  expansion — tracked in `frontend/STATUS.md`'s "Known gaps" list.
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

## Not yet built (explicitly deferred so far)

1. **Next.js frontend** — All 6 phases complete (connectivity, generate view, styled
   preview + selection, chat-scoped revision, cover letter mode, download). See above and
   `frontend/STATUS.md` for details.
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
  200, real downloads) — no contract mismatches on either side. No open backend or
  frontend gaps remain from this plan.
- The only remaining work is the Cloudflare Tunnel + Vercel deployment infrastructure
  pass — not a feature gap, just deployment plumbing.
- Whether to bump `MAX_INPUT_CHARS` or `DAILY_CALL_LIMIT` once real usage patterns are
  known (e.g. a very long job posting, or heavier revise-loop iteration during editing).
