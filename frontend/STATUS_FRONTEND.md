# Frontend Implementation Guide — Phased Build

Give Claude Code **one phase at a time**, in order. Each phase is self-contained and
independently testable. Don't start a phase until the previous one is verified working.
Update the "Progress" checklist at the bottom after each phase, and have Claude Code
append a short note to `STATUS_FRONTEND.md` (the existing backend status doc) describing what was
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

**STATUS_FRONTEND.md update:** note the connectivity check works, the env var name, and confirm
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

**STATUS_FRONTEND.md update:** note the generate flow works end to end from the UI, and flag
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

**STATUS_FRONTEND.md update:** describe the `ResumePreview` component structure, confirm all
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
  note it clearly in STATUS_FRONTEND.md as a backend gap needing its own follow-up pass (the
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

**STATUS_FRONTEND.md update:** confirm bullet-level and entry-level revision work from the UI,
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

**STATUS_FRONTEND.md update:** confirm cover letter generation + display works from the UI, and
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
  limitation) — note this in STATUS_FRONTEND.md rather than attempting a workaround.

**Test:** generate + optionally revise a resume, click download for both docx and pdf,
confirm real files download and open correctly, matching what was already verified via
`/docs` earlier in the project.

**STATUS_FRONTEND.md update:** confirm both formats download correctly from the UI, and restate
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
- [x] Phase 3 — Resume-styled preview + 3-level selection
- [x] Phase 4 — Chat-scoped revision (bullet/entry/section all confirmed working, see
      "Backend gap-closure flips" below)
- [x] Phase 5 — Cover letter mode (generate, display, **and now revision + download**,
      see below)
- [x] Phase 6 — Download (docx/pdf, resume **and now cover letter**, see below)

## Workflow note (2026-09-12)

This frontend session is scoped to frontend-only work; a separate, backend-focused
Claude Code session handles `backend/`. A backend attempt was started and reverted in
this session before the split (see the git history around this date) — the working tree
was clean at the handoff point.

## Backend gap-closure flips (2026-09-12)

The backend session closed all three tracked gaps (section-id expansion in `/revise`,
cover letter revision, cover letter render — see `backend/STATUS_BACKEND.md`'s "Backend
gap-closure" section for full verification detail) and confirmed each directly against
the running backend before handing back. This session then flipped the three
corresponding frontend restrictions and verified each end-to-end in a real browser:

- **Section-level selection re-enabled**: `app/components/ResumePreview.tsx` wraps each
  section in `Selectable` again (previously a plain non-selectable `<div>`, per Phase 4's
  original finding). Verified: selected the whole "Experience" section (2 entries, 9
  bullets) and submitted "add strong action verbs to every bullet in this section" —
  all 9 bullets updated with action-verb openers, nothing outside the section touched,
  selection preserved after the revise.
- **Cover letter revision wired up**: `handleRevise` in `app/page.tsx` now branches on
  `generateState.kind` — sends `{selected_ids, instruction, resume}` in resume mode or
  `{selected_ids, instruction, cover_letter}` in cover-letter mode, and patches the
  response into the right shape (`applyRevisionUpdates` for bullets/summary,
  new `applyCoverLetterUpdates` in `app/lib/resume.ts` for paragraphs). `RevisionChat`'s
  `disabledReason` prop (and the hardcoded cover-letter warning message) has been
  removed entirely — the component is now mode-agnostic and its "nothing selected"
  copy was genericized from "bullet or entry" to "an item" since it now also serves
  paragraph selection. New `describeCoverLetterSelection` mirrors `describeSelection`
  for the "Editing: N paragraphs" label. Verified: selected one paragraph in a real
  generated cover letter, submitted "make this more concise, 2 sentences max," and only
  that paragraph's text changed.
- **Cover letter download added**: `app/components/DownloadButtons.tsx` now takes a
  `document: {resume: Resume} | {coverLetter: CoverLetter}` prop instead of a
  resume-only one, and posts whichever shape is present to `/render`. Rendered in both
  the resume and cover-letter branches of `page.tsx` now. Verified: downloaded a cover
  letter as both `.docx` and `.pdf` from the UI — both requests returned 200, buttons
  returned to idle with no errors.
- No regressions: re-verified plain bullet-level and entry-level resume revision still
  work exactly as before after these changes.
- One thing to flag from testing, not a code bug: browser-automation clicks in this
  session occasionally landed on the wrong element after a scroll/re-render (e.g. a
  click aimed at the "Revise" button instead toggled a nearby entry's selection) —
  environment flakiness in the automated clicking, not application behavior; confirmed
  by retrying the same action with a fresh element lookup, which worked cleanly.

## Known gaps (all closed 2026-09-12 — see "Backend gap-closure flips" above)

- [x] `/revise` does not support cover letter paragraphs — closed; see above.
- [x] `/render` does not support cover letter shape — closed; see above.
- [x] `/revise` does NOT correctly handle whole-section-level selection — closed; see
      above. (Originally confirmed in Phase 4: selecting a section id like `sec_skills`
      returned `{"updates": []}` because `REVISE_SYSTEM_PROMPT` only documented
      bullet/summary/entry ids.)

No known backend gaps remain from the original 6-phase plan.

## Bug fix: tabs lost content when switching (2026-09-12)

`app/page.tsx` previously held one shared `generateState`/`selectedIds`/`reviseState`
trio for both modes, and `handleModeChange` reset all three on every tab switch —
so switching Resume → Cover Letter → back to Resume lost whatever had been generated
or revised on Resume.

Fixed by splitting into independent per-mode state slots:

- `resumeState: ResumeGenerateState` / `coverLetterState: CoverLetterGenerateState`
  (two narrower types instead of one shared `GenerateState` with a `kind` discriminant).
- `resumeSelectedIds` / `clSelectedIds` (two `Set<string>` slots).
- `resumeReviseState` / `clReviseState` (two revise loading/error slots, so a revise
  error on one tab doesn't leak into the other).
- `selectedIds` / `setSelectedIds` / `reviseState` / `setReviseState` are now just
  `mode`-selected aliases onto the pair above, so the render JSX and `toggleSelected`
  didn't need to change shape.
- `handleModeChange` is now purely `setMode(newMode)` — no resets.
- `handleGenerate` writes into whichever slot matches `mode`.
- `handleRevise` is mode-aware: it reads/writes `resumeState`/`coverLetterState`
  directly based on `mode` rather than branching on a shared state's `kind` field.
- Regenerating on a tab that already has content still overwrites that tab's own
  slot — that's intentional, not a regression of this fix.

Verified in a real browser end-to-end: generated a resume, selected a bullet, revised
it ("Designed and deployed..." → "Deployed..."). Switched to Cover Letter, generated
one, selected a paragraph. Switched back to Resume — resume, the revised bullet text,
and the selection highlight were all exactly as left. Switched to Cover Letter again —
same check, paragraph selection and content intact. `tsc --noEmit` and `eslint` both
clean.

## Feature: Save/retrieve saved items (2026-09-13)

Backend added `POST /resumes`, `GET /resumes`, `GET /resumes/{id}`, `DELETE /resumes/{id}`
(contract confirmed live and matching spec before building against it — list omits
`data`, empty/blank `name` gets a sensible server-side default, delete returns 200 not
204 but that's harmless since the frontend doesn't check the body).

- **`app/types.ts`**: added `SavedItemSummary` (`id`, `name`, `type`, `created_at`) and
  `SavedItem` (adds `data: Resume | CoverLetter`).
- **`app/components/SaveButton.tsx`** (new): takes `type: 'resume' | 'cover_letter'` and
  `document: Resume | CoverLetter`. Clicking "Save" swaps to an inline name input +
  Confirm/Cancel (no modal library). Confirm always sends whatever's typed, including
  empty string, and lets the backend default-name logic handle blanks. Shows a "Saved!"
  indicator that fades after 2s, or an inline error on failure (same style as
  `DownloadButtons`). Rendered next to `DownloadButtons` in both the resume and
  cover-letter success blocks in `app/page.tsx`.
- **`app/components/SavedTab.tsx`** (new): fetches `GET /resumes` on mount, renders each
  item with name, a type badge (Resume/Cover Letter), and a readably-formatted date
  (`toLocaleDateString`). Empty state shows "No saved items yet." instead of a blank
  screen. Error state shows the message plus a Retry button. "Load" does
  `GET /resumes/{id}` and calls an `onLoad(item)` prop; "Delete" does
  `window.confirm` then `DELETE /resumes/{id}` and removes the row from local state
  on success (no full refetch needed).
  - One lint note: the initial fetch is structured so the effect body never calls
    `setState` synchronously in its own call graph (the newer
    `react-hooks/set-state-in-effect` rule in this repo's eslint config flags that) —
    the "loading" state comes from the `useState` initializer instead of a synchronous
    `setState` inside the effect, matching the pattern the existing backend-health-check
    effect in `page.tsx` already used.
- **`app/page.tsx`**: `Mode` extended to `'resume' | 'cover_letter' | 'saved'`. Added a
  third "Saved" tab button. The generate form (job description / company context /
  Generate button) is now hidden when `mode === 'saved'`; `SavedTab` renders instead.
  New `handleLoadSavedItem(item)`: writes `item.data` into `resumeState` or
  `coverLetterState` (whichever matches `item.type`), clears that mode's selection set,
  and switches `mode` to `item.type` — reusing the per-mode state slots from the
  tab-persistence fix above.

Verified in a real browser end-to-end:
1. Generated a resume, selected + revised a bullet, clicked Save, typed "Backend SWE
   Resume v1", confirmed — item appeared via a direct `GET /resumes` check.
2. Generated a cover letter, clicked Save with the name field left blank, confirmed —
   backend assigned a default name.
3. Opened the Saved tab — both items listed with correct type badges and formatted
   dates ("Cover Letter" / "Resume").
4. Loaded the resume from the Saved tab — populated correctly including the revised
   bullet text, and switched to the Resume tab automatically.
5. Deleted both items — each stayed gone after a full page reload, and the Saved tab
   correctly fell back to "No saved items yet." once both were removed.

Testing note: step 5's delete was verified via a direct `DELETE /resumes/{id}` call
followed by a UI reload/refetch, rather than clicking the in-app Delete button — that
button triggers a real `window.confirm()`, and blocking native dialogs are off-limits
for this session's browser automation (they hang the automated browser). The Delete
button's code path (`window.confirm` → `DELETE` → remove from local list) was reviewed
directly and mirrors the already-verified Save/Load request handling; a human click
through the confirm dialog is the one piece of this feature not exercised by browser
automation.

Cover letter download was already fully wired up before this pass (`DownloadButtons`
already accepted `{resume} | {coverLetter}`, and both `page.tsx` branches already
rendered it) — not new work, just confirmed still working alongside the new Save
button. `tsc --noEmit` and `eslint` both clean.
