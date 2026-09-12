# Frontend Implementation Guide — Phased Build

Give Claude Code **one phase at a time**, in order. Each phase is self-contained and
independently testable. Don't start a phase until the previous one is verified working.
Update the "Progress" checklist at the bottom after each phase, and have Claude Code
append a short note to `STATUS.md` (the existing backend status doc) describing what was
built and verified, same format as prior backend passes.

## Reference: what already exists (backend, fully built)

- `GET /health`, `GET /profile`, `GET /usage`
- `POST /generate` — `{job_description, company_context?, type: "resume"|"cover_letter"}`
  → `{resume: Resume | null, cover_letter: CoverLetter | null}`
- `POST /revise` — `{selected_ids, instruction, resume}` → `{updates: [{id, text}]}`
  (cover letter revision NOT yet supported server-side — resume only for now)
- `POST /render` — `{resume: Resume, format: "docx"|"pdf"}` → downloadable file
  (cover letter rendering NOT yet supported server-side — resume only for now)
- Backend runs at `http://127.0.0.1:8000` locally, CORS wide open for now

Resume JSON shape: `meta`, `summary`, `sections[]` (each with `id`, `title`, `type`,
`entries[]` and/or `groups[]`, entries have `bullets[]`), every bullet/entry/section has
a stable `id`.

Cover letter JSON shape: `meta` (name/email/phone/date/company/role), `paragraphs[]`
(each `{id, text}`).

---

## Phase 1 — Connectivity check

**Goal:** confirm the Next.js app can talk to the local FastAPI backend before building
any real UI.

- Add an environment variable for the backend URL: `frontend/.env.local` with
  `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` (add `.env.local` to `.gitignore` if not
  already covered — check first).
- On the home page, make a simple `fetch` to `${NEXT_PUBLIC_API_URL}/health` on load and
  display the result (e.g. "Backend: ok" or an error message if unreachable).
- This confirms CORS is working and the env var wiring is correct before anything else
  is built on top of it.

**Test:** load `localhost:3000` with the backend running — see "Backend: ok". Stop the
backend, reload — see a clear error state, not a silent failure or unhandled exception.

**STATUS.md update:** note the connectivity check works, the env var name, and confirm
CORS didn't need adjustment (it's still `*` from the backend side).

---

## Phase 2 — Generate view (resume only first)

**Goal:** paste a job description, generate a resume, display the raw result. No
styling polish, no selection yet — just prove the data flow works end to end.

- Build a form: textarea for `job_description`, optional textarea for `company_context`,
  a "Generate Resume" button.
- On submit, `POST` to `/generate` with `{job_description, company_context, type:
"resume"}`.
- Store the returned `resume` object in React state (`useState`).
- Render it minimally below the form — doesn't need to look good yet, just show the
  structure is there (e.g. `<pre>{JSON.stringify(resume, null, 2)}</pre>` is fine for
  this phase, or a very basic unstyled list of sections/bullets — whichever is faster to
  verify with).
- Handle loading state (disable button, show "Generating...") and error state (API
  error, network failure) clearly.

**Test:** paste a real job description, confirm a resume comes back and renders
(even unstyled) with sensible tailored content matching what was already verified
working via `/docs` earlier.

**STATUS.md update:** note the generate flow works end to end from the UI, and flag
that styling is deliberately deferred to Phase 3.

---

## Phase 3 — Resume-styled preview + selection (bullet, entry, section)

**Goal:** replace the raw/minimal render from Phase 2 with a component that actually
looks like the final resume, and add the three-level selection behavior.

- Build a `ResumePreview` component that renders the resume JSON to visually resemble
  the final docx/pdf output: centered name + contact line at top, summary paragraph,
  each section as a clear heading, experience/project entries with bold title —
  organization, right-aligned or same-line dates, italic location, bulleted lists;
  education/certs as clean single lines; skills as bold label + comma-separated items.
  Match the general visual structure already defined in `render.py`'s docx template
  (check that file for the exact layout decisions already made) — the goal is "what you
  see is close to what you'll download," not pixel-perfect matching.
- Every **bullet**, every **entry** (whole job/project block), and every **section**
  (e.g. the whole Skills block) must be independently clickable/selectable using their
  `id`.
- Selection behavior, exactly as specified:
  - **Hover** → visual highlight (e.g. subtle background tint or border), purely
    transient — disappears when the cursor leaves, no state change.
  - **Click** → toggles **persistent** selection (a different, more prominent highlight
    that stays after the cursor moves away).
  - **Click again on a selected item** → deselects it, returning to normal (unselected,
    still hoverable) state.
  - Multiple items can be selected simultaneously, at any mix of levels (e.g. two
    bullets from one job plus the entire Skills section at once).
- Selected IDs should live in a `Set<string>` or array in React state
  (`selectedIds`), separate from the `resume` state itself.
- No `/revise` wiring yet in this phase — just get selection state and visual behavior
  fully correct and verified first.

**Test:** generate a resume, confirm it visually resembles a real resume (not a JSON
dump), hover over several different bullets/entries/sections and confirm transient
highlight, click to select multiple items at different levels simultaneously and confirm
they all show persistent highlight, click one again and confirm it deselects while
others remain selected.

**STATUS.md update:** describe the `ResumePreview` component structure, confirm all
three selection levels work independently and can combine, and note any visual
deviations from the docx template that were simplified for the browser (e.g. font
availability differences) — these are fine and expected, just document them.

---

## Phase 4 — Chat-scoped revision

**Goal:** wire the selection from Phase 3 to `/revise`, patch results back into the
displayed resume.

- Add a chat/instruction input, fixed in a sensible place in the layout (e.g. pinned at
  the bottom of the preview pane, or a persistent side panel — Claude Code's choice
  unless you have a preference).
- The input is disabled (or visibly inert) when `selectedIds` is empty. When at least
  one item is selected, show a small indicator of what's currently selected (e.g.
  "Editing: 2 bullets, 1 section") so it's clear what scope the next instruction will
  apply to.
- On submit: `POST /revise` with `{selected_ids: Array.from(selectedIds), instruction,
resume}` (the current full resume state).
- On response: for each `{id, text}` in `updates`, find that id anywhere in the resume
  JSON tree (bullet text, or summary text) and replace it in place in React state. This
  should cause `ResumePreview` to re-render with just those pieces changed — verify nothing
  else shifts or resets (especially: don't clear `selectedIds` after a revise, in case
  the user wants to submit another instruction against the same selection).
- Handle the entry-selection case correctly: if an entry id was selected (not
  individual bullets), the backend already expands this to per-bullet updates in its
  response (`ReviseUpdate` items keyed by bullet id, not the entry id) — the frontend
  just needs to patch by whatever ids come back in `updates`, regardless of what was
  originally selected. Confirm this works by testing entry-level selection specifically,
  not just individual bullets.
- Handle the whole-**section**-level selection case: this is new — the backend's
  `/revise` currently expects bullet/entry/summary ids (per its existing system prompt).
  Test whether selecting a whole section (e.g. `sec_skills`) and submitting an
  instruction currently works correctly against the existing backend, or produces
  unexpected results (e.g. is silently skipped, since it's not a bullet/entry it may not
  match anything the backend's prompt expects). **If section-level revision doesn't work
  correctly against the current backend, do not attempt to fix this in the frontend** —
  note it clearly in STATUS.md as a backend gap needing its own follow-up pass (the
  `/revise` system prompt needs to learn how to expand a section id, similar to how it
  already expands an entry id to its bullets), and disable/hide section-level selection
  in the UI for now if it produces broken results, re-enabling once the backend supports
  it.
- Handle errors (429 rate limit, 502 bad LLM output) with a clear inline message, not a
  silent failure.

**Test:** select a single bullet, submit "make this more concise," confirm only that
bullet changes. Select an entire job entry, submit "emphasize leadership," confirm all
its bullets update via the entry-expansion behavior. Try selecting a whole section and
document what actually happens per the note above.

**STATUS.md update:** confirm bullet-level and entry-level revision work from the UI,
and clearly document the section-level revision finding (works / doesn't work / partially
works) as a flagged item for the next backend pass if needed.

---

## Phase 5 — Cover letter mode

**Goal:** add the resume/cover-letter toggle from the generate view, and a preview
component for cover letters (read-only selection is fine for now, given `/revise`
doesn't support cover letters server-side yet).

- Add a toggle/tabs on the generate view: "Resume" / "Cover Letter". Selecting one sets
  the `type` sent to `/generate` and determines which shape comes back
  (`resume` vs `cover_letter` in the response).
- Build a `CoverLetterPreview` component: styled to resemble a real business letter —
  date, company/role context if present, salutation, each paragraph, sign-off. Match the
  general tone of the resume preview's polish level.
- Paragraph-level selection (hover/click/persistent, same interaction pattern as Phase 3)
  is fine to include for consistency, but **the chat input for cover letters should be
  visibly disabled with an explanation** (e.g. "Cover letter editing isn't available yet
  — download and edit directly for now") since `/revise` doesn't handle cover letters
  server-side yet. Don't silently let the user submit an instruction that will fail or
  do nothing.

**Test:** toggle to Cover Letter, generate one from a real job description, confirm it
renders readably and looks distinct from the resume view. Confirm attempting to select

- revise is either disabled or clearly communicates it's not yet supported.

**STATUS.md update:** confirm cover letter generation + display works from the UI, and
restate clearly that cover letter revision is blocked on a backend gap (already known,
not new).

---

## Phase 6 — Download

**Goal:** wire the download button to `/render`.

- Add a download control (button or small format-choice dropdown: docx / pdf) visible
  when a resume is loaded.
- On click: `POST /render` with `{resume, format}`, handle the binary file response, and
  trigger a browser download (construct a `Blob` from the response and use a temporary
  `<a>` element with `download` attribute, or the equivalent modern approach).
- Disable/hide the download control for cover letters for now, since `/render` doesn't
  support the cover letter shape yet (same category of gap as Phase 5's revision
  limitation) — note this in STATUS.md rather than attempting a workaround.

**Test:** generate + optionally revise a resume, click download for both docx and pdf,
confirm real files download and open correctly, matching what was already verified via
`/docs` earlier in the project.

**STATUS.md update:** confirm both formats download correctly from the UI, and restate
the cover-letter-render gap as a known follow-up.

---

## After all phases

At this point you have a fully working local app: generate (resume + cover letter),
select + revise (resume only), download (resume only, both formats). Two backend gaps
will be flagged and tracked (cover letter revise, cover letter render) — these become
their own small follow-up pass, not part of this frontend build. After that, remaining
work is the Cloudflare Tunnel setup + Vercel deployment, which is infrastructure, not
new features.

---

## Progress checklist

- [x] Phase 1 — Connectivity check
- [x] Phase 2 — Generate view (resume, unstyled)
- [ ] Phase 3 — Resume-styled preview + 3-level selection
- [ ] Phase 4 — Chat-scoped revision (bullet/entry confirmed; section-level status TBD)
- [ ] Phase 5 — Cover letter mode (generate + display only)
- [ ] Phase 6 — Download (docx/pdf, resume only)

## Known gaps to track for a future backend pass

- [ ] `/revise` does not support cover letter paragraphs
- [ ] `/render` does not support cover letter shape
- [ ] `/revise` may not correctly handle whole-section-level selection (confirm in
      Phase 4 and update this line with the actual finding)
