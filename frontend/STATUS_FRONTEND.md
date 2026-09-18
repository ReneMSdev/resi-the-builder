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
`data`, empty/blank `name` gets a sensible server-side default). `DELETE` was later
tightened to return **204 No Content** (was 200 + a small body) — no frontend change
needed since the body was never read.

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
  `GET /resumes/{id}` and calls an `onLoad(item)` prop; "Delete" swaps that row's
  Load/Delete buttons for an inline "Delete this item?" + Confirm/Cancel step
  (`confirmingId` state) instead of `window.confirm` — Confirm then does
  `DELETE /resumes/{id}` and removes the row from local state on success (no full
  refetch needed). Replaced the native dialog specifically because it's a blocking
  call browser automation can't click through, so the whole flow can now be verified
  end-to-end instead of only reviewed; it also matches `SaveButton`'s existing
  inline-prompt pattern rather than introducing a different confirmation style.
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

**Resolved (2026-09-13, manager session)**: step 5's delete was originally only
reviewed, not click-tested, because `window.confirm()` blocks automated browsers. Fixed
by replacing it with the inline Confirm/Cancel step described above, then click-tested
for real: seeded an item via the API, opened the Saved tab, clicked Delete (inline
"Delete this item?" + Confirm/Cancel appeared, no native dialog), clicked Confirm, item
removed from the list and confirmed gone via a subsequent `GET /resumes`. Full click-path
now exercised, not just reviewed.

Cover letter download was already fully wired up before this pass (`DownloadButtons`
already accepted `{resume} | {coverLetter}`, and both `page.tsx` branches already
rendered it) — not new work, just confirmed still working alongside the new Save
button. `tsc --noEmit` and `eslint` both clean.

## Feature: Summary selection & revision (2026-09-15)

Phase 3 named only bullet/entry/section as selectable, leaving the resume summary out
even though `/revise` already accepted its id. Closed that gap:

- **`app/components/ResumePreview.tsx`**: the summary paragraph is now wrapped in
  `Selectable` using `resume.summary.id` (whatever id `/generate` actually minted, e.g.
  `summary_r1` — not assumed to be the literal string `"summary"`), same
  hover/click/persistent-highlight pattern as everything else.
- **`app/lib/resume.ts`**: `describeSelection` now reports a summary selection
  distinctly (`"1 summary"`) instead of silently doing nothing for it.
- `applyRevisionUpdates` already patched summary text when the summary's id showed up
  in `updates` (pre-existing code) — confirmed still correct now that summary is
  actually selectable, no fix needed.

Verified in a real browser: generated a fresh resume, selected only the summary
(nothing else), submitted "Make this more concise, one sentence," confirmed only the
summary text changed (Experience/Projects/etc. untouched), and selection stayed
highlighted afterward with "Editing: 1 summary" shown throughout.

**Note while testing**: the backend's Aug/Sep skill-item and link `id` schema was
already live on the backend (`SkillGroup.items` as `{id, text}` objects, `Link.id`
required) before the frontend caught up. Until the Part B work below landed, this
caused two visible symptoms: freshly generated resumes rendered `[object Object]` for
every skill item (`group.items.join(", ")` on an array of objects), and `/revise`
against the old pre-migration saved sample data 422'd on missing `link.id`s. Neither
was a summary-selection bug — both are fixed by the Part B change below.

## Feature: Skill group selection & revision (2026-09-15)

Backend migrated `SkillGroup.items` to `{id, text}[]` and gave `Link` an `id` field,
added group-level + whole-section revision support to `/revise`, and migrated the
stored profile data — see backend's own status notes. Frontend side:

- **`app/types.ts`**: `SkillGroup.items` is now `{ id: string; text: string }[]`
  (was `string[]`); `Meta.links` entries gained `id: string`.
- **`app/components/ResumePreview.tsx`**: each skill group is now individually
  wrapped in `Selectable` (`group.id`), matching the pattern already used for entries
  within experience/projects — previously only the whole section was selectable, and
  even that visually did nothing useful for skills since none of its children were.
  Items render as `.text` values joined with `", "` into one text node (no per-item
  elements, so no per-item key is needed — `item.id` exists for `/revise` and the
  future inline-editing phase, not for React reconciliation here).
- **`app/lib/resume.ts`**:
  - `applyRevisionUpdates`: an update whose `id` matches a skill group (rather than a
    bullet or the summary) is treated specially — its `text` is a comma-joined string
    that gets split back into a fresh `items` array (each piece trimmed), with a new
    `crypto.randomUUID()` id per item. Per-item ids are not preserved across a group
    rewrite by design (mirrors bullet ids regenerating server-side on `/generate`) —
    backend's response is `{id: group_id, text: "a, b, c"}` with no per-item ids to
    preserve anyway.
  - `describeSelection`: now also counts skill-group selections separately
    (`"N skill groups"`) alongside summary/bullet/entry/section counts.

Verified in a real browser: generated a fresh resume, selected a single skill group
and asked to add an item — the group's items re-rendered correctly with a new item
appended, no stale `[object Object]` output. Selected the whole Skills section and
revised — every group updated in one round trip. Re-ran the Part A summary check and a
plain bullet/entry revision afterward as a regression check — both still work
unchanged. `tsc --noEmit` and `eslint` both clean.

**Future direction**: inline manual editing (click any rendered field — bullets,
summary, skill items, links, cover-letter salutation, etc. — and type directly,
with manual edits surviving later chat-scoped revisions) is a planned future phase,
not built in this pass. The stable `id`s added here for skill items and links (and
already present on bullets/entries/summary/paragraphs) are intentional prep for that
phase, not currently used for anything beyond `/revise` targeting and React keys.

## Compatibility pass: meta/entry fields + cover-letter salutation as `{id, text}` (2026-09-16)

Continuation of the id-inventory work above, ahead of the still-separate inline-editing
phase. Backend migrated `Resume.meta.name/email/phone`, `Entry.title/organization/
location/dates`, and all six `CoverLetterMeta` fields from plain strings to a generic
`{id, text}` shape, and added `salutation`/`sign_off: {id, text}` to `CoverLetter`
(previously hardcoded "Dear Hiring Manager," / "Sincerely," in `CoverLetterPreview.tsx`).
This pass is purely defensive — no new selection UI — since leaving these as plain-string
reads once the backend shape changed would have silently rendered `[object Object]`
everywhere, the same failure mode hit with skill items in the previous pass.

- **`app/types.ts`**: added a shared `IdText = { id: string; text: string }` type.
  `Meta.name/email/phone`, `Entry.title/organization/location/dates`, and all of
  `CoverLetterMeta` are now `IdText` (all required — backend always sends an id even
  when the text is empty, so `Entry.location`/`dates` are no longer optional).
  `CoverLetter` gained `salutation: IdText` and `sign_off: IdText`.
- **`app/components/ResumePreview.tsx`** / **`CoverLetterPreview.tsx`**: every read of
  these fields now goes through `.text` (`resume.meta.name.text`, `entry.dates.text`,
  etc.). Truthy checks that used to gate on the field itself (`meta.date &&`,
  `entry.location &&`, `[meta.role, meta.company].filter(Boolean)`) now check `.text`
  specifically — checking the object itself would always be truthy even with empty
  text, since backend always includes the id. `CoverLetterPreview.tsx`'s hardcoded
  salutation/sign-off paragraphs are now `coverLetter.salutation.text` /
  `coverLetter.sign_off.text`.
- **`app/lib/resume.ts`**: added a small `patchIdText(field, updateMap)` helper and
  used it everywhere an `IdText` leaf can appear — `resume.meta.name/email/phone`,
  `entry.title/organization/location/dates`, `resume.summary`,
  `coverLetter.meta.*`, `coverLetter.salutation`, `coverLetter.sign_off` — plain
  text-replace, no comma-splitting (that's still skill-group-only). None of these
  fields are selectable yet, so `applyRevisionUpdates`/`applyCoverLetterUpdates`
  won't currently receive their ids from a real selection, but the patch logic is in
  place for when the next phase makes them selectable.
- No `Selectable` wrapping was added to any of these fields, per scope — that's
  deliberately deferred to the inline-editing phase.

Verified in a real browser: generated a fresh resume and a fresh cover letter (job
description named a hiring manager) — nothing rendered as `[object Object]`, and the
cover letter's salutation correctly used the named hiring manager ("Dear Jane Smith,")
via `/generate`'s existing salutation-picking logic. Regression-checked: summary
revision, a single bullet revision, a combined bullet+skill-group multi-select
revision (both updated correctly in one round trip), and a cover-letter paragraph
revision — all still work unchanged. `tsc --noEmit` and `eslint` both clean.

## Feature: Inline manual editing, layered on chat-scoped select+revise (2026-09-16)

Design decisions came from the user via the manager session, not derived independently:
a single global Select/Edit toggle for the whole preview pane (not per-item); structural
edits (adding/removing whole entries or sections) out of scope this pass — only
leaf-level items (bullets, skill items, links) get add/remove; manual-edit-vs-later-
chat-revision protection/tracking explicitly deferred (see "Known gap" below);
`Section.title` stays a plain string, unchanged, out of scope.

### Phase 1 — Mode toggle infrastructure

- **`app/page.tsx`**: one `previewMode: 'select' | 'edit'` state (default `'select'`),
  shared across the resume and cover-letter tabs (a true global toggle, not per-tab).
  New `ModeToggle` segmented control rendered next to the selection-count indicator in
  both success blocks. Switching modes never touches `selectedIds` — it's a separate
  piece of state and nothing in the toggle handler reaches it.
- **`app/components/Selectable.tsx`**: added `mode`, `hoveredId`, `onHover` props.
  `onClick` only calls `onToggle` when `mode === 'select'` — in `'edit'` mode, clicking
  a Selectable's own chrome (not an editable field inside it) is a no-op. Cursor is
  `cursor-pointer` in select mode, `cursor-default` in edit mode (editable text spans
  inside supply their own `cursor-text`, see Phase 2). The hover background color
  itself differs by mode too (`--accent-soft` vs `--edit-soft`).
- **Hover isolation bug found and fixed while building this**: the initial
  implementation used `onMouseEnter`/`onMouseLeave` with `stopPropagation()` to lift a
  single `hoveredId` (local `useState` in each of `ResumePreview`/`CoverLetterPreview`)
  up from whichever Selectable the pointer is actually over. In the browser this did
  not work — hovering a bullet lit up the entire enclosing section instead of just the
  bullet (confirmed via a DOM query for the inline `background-color` style: only the
  *section*-level element ever had it, never the entry or bullet). `mouseenter`/
  `mouseleave` don't natively bubble, and calling `stopPropagation()` on them turned out
  to interfere with how React's synthetic event system computes which ancestors get
  notified, leaving stale/wrong elements "entered." Fixed by switching to
  `onMouseOver`/`onMouseOut` (which do bubble, with well-defined, reliable
  `stopPropagation()` semantics) — verified afterward via the same DOM inspection that
  hovering a bullet highlights only the `<li>`, hovering an entry's own chrome (its
  title/dates row, not over any bullet) highlights only the entry, and hovering a
  section's own chrome (its heading, not inside any entry) highlights only the section.
  One known minor UX quirk from the simple `onHover(null)`-on-leave approach: leaving a
  nested item while still within an ancestor's chrome briefly shows nothing highlighted
  until the next `mouseover` (rather than instantly reverting to the ancestor's
  highlight) — acceptable, not a correctness issue, and nobody asked for pixel-perfect
  continuity here.

### Phase 2 — Inline editing for scalar text fields

- **New `app/components/InlineEdit.tsx`**: `EditableText` (click a rendered text field
  in edit mode → swaps to an `<input>`/`<textarea>` in place, pre-filled and
  auto-selected; Enter saves, Escape reverts and cancels, Shift+Enter inserts a newline
  for `multiline` fields, blur also saves). `JoinedFields` renders a set of `IdText`
  fields separated by a delimiter (e.g. title — organization — dates), hiding
  empty fields in select mode (matching the old `.filter(Boolean).join(...)` behavior)
  but showing them with a placeholder in edit mode so an empty field is still reachable
  to fill in.
- Applied to every scalar field named in the spec: bullets, summary, `Entry`
  title/organization/location/dates, `Meta` name/email/phone, `CoverLetterMeta`'s six
  fields, `CoverLetter` salutation/sign_off, cover-letter paragraphs.
- Saving reuses the existing `applyRevisionUpdates` / `applyCoverLetterUpdates` from the
  compatibility pass above — a manual edit calls `onEditField(id, text)` in `page.tsx`,
  which does exactly `applyRevisionUpdates(resume, [{id, text}])`, the same function and
  the same `{id, text}` shape a `/revise` response already produces. No new mutation
  path, no API call for a plain text edit.

### Phase 3 — Add/remove for leaf-list items (bullets, skill items, links)

- **`app/lib/resume.ts`**: added `addBullet`/`removeBullet`,
  `addSkillItem`/`removeSkillItem`/`editSkillItem`, `addLink`/`removeLink`/`editLink` —
  all pure, immutable, mirroring the existing map/filter/spread style. New items get a
  `crypto.randomUUID()` id, same pattern already used for skill-group-rewrite ids.
- **`InlineEdit.tsx`** also has: `AddGhostRow` (dashed ghost row → inline input in that
  slot on click; blur-while-empty or Escape cancels with nothing added — used for
  bullets), `TextPill`/`AddPill` (skill-item chips: click text to edit inline, hover
  reveals a fading-in ✕ to remove, trailing dashed "+ Add item" ghost pill), and
  `LinkPill`/`AddLinkPill` (same ✕/add-pill treatment as skill items, but two stacked
  inputs — label then URL — since a link has two parts).
- **`ResumePreview.tsx`**: skill groups render as pills only in edit mode (select mode
  keeps the original comma-joined text, unchanged); bullets get a per-bullet hover-fade
  ✕ (plain Tailwind `group`/`group-hover`, not the JS hover system above — no nested-
  Selectable-bleed concern for a same-element sibling button) plus a trailing "+ Add
  bullet" ghost `<li>`; `Meta.links` gets its own pill row in edit mode (select mode's
  single piped contact line is unchanged) with a trailing "+ Add link" ghost pill.
- Cover letter has no leaf-list add/remove (paragraphs aren't in the
  bullets/skill-items/links list from the spec) — Phase 2 scalar editing only.

### Verification (real browser, not just code review)

- Toggled Select ↔ Edit repeatedly with a bullet already selected — `selectedIds`
  survived every toggle in both directions, "Editing: 1 bullet" stayed correct
  throughout, and the preview pane's border/hover-tint color visibly changed with mode.
- Confirmed hover isolation for all three nesting levels (bullet-only, entry-own-chrome-
  only, section-own-chrome-only) via direct DOM inspection, not just eyeballing a
  screenshot.
- Edited the resume name, an entry's dates field (Escape-cancel tested first — reverted
  correctly, nothing saved), and a skill item's text — each patched only the target
  field, nothing else shifted.
- Removed a skill item (✕, no confirm), added a new one ("Kubernetes"), edited an
  existing one's text — ids didn't collide, rendering stayed correct (no stale
  `[object Object]`).
- Removed a bullet, added a new one via the ghost row — same result.
- Added a link via the two-stacked-input flow (clicked label field, typed, clicked into
  the URL field, typed, Enter committed both at once), edited an existing link
  (Escape-cancel tested first), removed a link.
- Regression: switched back to Select mode and ran a real chat-scoped `/revise` on a
  plain bullet, then on a skill group with manually-added/renamed items already in it
  (group's edited state — including the manually added "Kubernetes" item and the
  renamed "Node.js (TypeScript)" item — round-tripped correctly through the revise and
  came back re-alphabetized with those edits intact) — both worked exactly as before.
- Cover letter: edited `meta.company` (filled from empty via its edit-mode placeholder),
  the salutation, and a paragraph (including a Shift+Enter-inserted newline, which
  Enter then correctly committed as part of the saved text — note the embedded `\n`
  doesn't render as a visual line break in the read-only `<p>` afterward, due to
  ordinary HTML whitespace collapsing; this is a pre-existing display characteristic of
  plain `<p>` text, not something this pass changed). Regression-checked a normal
  paragraph `/revise` afterward — still works (the LLM even naturally cleaned up the
  manually-added throwaway sentence as part of "make this more concise").
- Saved a resume with the manual edits/additions above, then rendered it through the
  live backend `/render` endpoint for both `.docx` and `.pdf` and inspected the actual
  extracted text of each (`unzip` + regex-stripped `document.xml` for docx; `pypdf` for
  PDF, installed to a scratch `--target` directory for this check only, not added to
  the project) — the manually-added bullet text, the manually-added skill item
  ("Kubernetes"), the manually-renamed skill item ("Node.js (TypeScript)"), and the
  manually-edited name all appeared correctly in both rendered formats. This is the
  first real exercise of `/render` with data that never passed through an LLM
  `/generate` or `/revise` call.
- `tsc --noEmit` and `eslint` both clean throughout.

### Known gap (deliberately deferred, not built)

No manual-edit-vs-later-chat-revision protection or tracking exists. If a field is
edited manually and later swept up in a broader chat-scoped revision (or vice versa),
there's no flag distinguishing "this came from a manual edit" from any other value, and
no logic to protect one from being overwritten by the other. This was explicit scope
for a future pass, not an oversight — the data shape used for an edited value
(`{id, text}` in local state, same as everything else) was deliberately kept plain so
that bolting a provenance flag on later doesn't require restructuring anything now.

## Feature: Application-workspace UI redesign — two-bar layout + polish round (2026-09-16)

Built on branch `redesign/application-workspace` (not yet merged to `main`), per a
design spec worked out between the user and the manager session, captured in
`TODO.md`'s "UI redesign" section. The manager broke this into checkpointed phases so
nothing ran too long; an initial nested Generate>JD/Resume/CL shell was built first,
then immediately revised into the flat two-bar layout below before anything was
committed — so only the final flat-layout shape ever landed in git.

### Two-bar flat layout (`app/page.tsx`)

- Replaces the old three-tab (Resume / Cover Letter / Saved) structure with two
  stacked bars: a top bar (logo, backend-connectivity status, a "Generate for new job"
  button) and a second bar of four flat peer-level tabs — Job Description, Resume,
  Cover Letter, Saved — no nesting.
- `Tab` state collapsed the old three-way `Mode` (`'resume' | 'cover_letter' |
  'saved'`) plus an interim nested sub-tab into one flat `'jd' | 'resume' |
  'cover_letter' | 'saved'`.
- New shared `GenerateForm` component (JD text + company-context text + 0/1/2 Generate
  buttons depending on what already exists) is the single component rendered in three
  places: the Job Description tab, the Resume tab (when no resume yet), and the Cover
  Letter tab (when no cover letter yet). Because it's the same component instance in
  all three spots, "a Generate button disappears everywhere once that content exists"
  falls out for free — there's no separate flag-syncing logic across tabs, just one
  `showResumeButton`/`showCoverLetterButton` prop pair driven off `resumeState`/
  `coverLetterState`.
- Job Description tab shows `GenerateForm` until both Resume and Cover Letter exist,
  then switches to a plain read-only block showing the raw pasted JD text (the
  *cleaned* JD text the backend added in parallel isn't wired in yet — still shows the
  raw string; a quick follow-up once that's confirmed ready).
- "Generate for new job" (top bar) replaces the old per-tab-click reset: wipes JD text,
  company context, both resume/cover-letter states, both selection sets, both revise
  states, and lands on the Job Description tab — same reset payload as before, just
  triggered by an explicit button instead of a nav-tab click, since "Generate" isn't a
  tab anymore.
- Action buttons (Select/Edit toggle, Save, Download) were already sitting above the
  preview content in the pre-existing code — carried that ordering into the new
  per-tab layout unchanged, no separate move was needed.
- `SavedTab.tsx` itself is untouched — it's now just one more peer tab in the row;
  `onLoad` routes into `Tab: item.type` instead of the old three-way mode switch.

### Polish round (`app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/components/RevisionChat.tsx`)

- Top bar background moved to a new `--topbar-bg` token (`#292524`, a dark stone —
  value later hand-tuned by the user directly in `globals.css`), separated from the
  page below it by a `border-b` plus the background-color contrast, with tighter
  vertical padding than the first pass.
- "Resume Builder" wordmark now renders in Roboto Mono (loaded via `next/font/google`
  — checked `node_modules/next/dist/docs` first per `AGENTS.md` before assuming the API
  matched training data; it did) at the `--accent` coral color instead of the previous
  serif/foreground styling. Weight went through a hand-edit by the user (600 → 700)
  directly in `layout.tsx`; the Tailwind weight class on the logo span was kept in sync
  (`font-semibold` → `font-bold`).
- Added `--success-on-dark`, a separate token for the "Backend: ok" text specifically
  on the dark top bar. Computed actual WCAG contrast ratios (relative-luminance
  formula, not eyeballed): the original `--success` (`#4f7942`) against the new
  `--topbar-bg` measures **2.99:1** — fails AA (needs 4.5:1). The new
  `--success-on-dark` (`#4ade80`) measures **8.71:1** against the same background —
  passes AA and AAA. `--success` itself was left unchanged, since `SaveButton.tsx`'s
  "Saved!" text still relies on it against the light `--surface` background (4.91:1
  there) — no single green satisfies AA against both a near-black and a near-white
  background at once, so a second token was the correct fix rather than a compromise
  value. (Flagged, not fixed: the top bar's error-state `--danger` text measures
  2.56:1 and its loading-state `--muted` text measures 3.47:1 against the same dark
  background — same root cause, out of scope until asked.)
- Added a divider (`border-b`, same `--border` token as the top bar's own separator)
  below the Job Description/Resume/Cover Letter/Saved tab row, spanning the content
  column's width, separating the tabs from the generated content/action buttons below.
- `RevisionChat.tsx`'s revision-instruction field changed from a single-line `<input>`
  to an auto-growing `<textarea>` (same resize pattern already used in
  `InlineEdit.tsx`: reset height to `auto`, then set to `scrollHeight`, re-run on every
  keystroke), capped at `max-h-[50vh]` with `overflow-y-auto` beyond that instead of
  pushing the rest of the page down. Enter submits, Shift+Enter inserts a newline (a
  necessary addition once Enter alone would otherwise submit prematurely on a
  multi-line box).
- **Border-box height bug found and fixed while building the above**: the textarea has
  `box-sizing: border-box` (Tailwind preflight default) and a 1px border on all sides.
  `scrollHeight` excludes borders by spec, so setting `style.height = scrollHeight +
  'px'` directly left the border-box height permanently ~2px short of what the content
  needed — a scrollbar showed even on a completely empty, single-line box. Confirmed
  via direct DOM measurement (`scrollHeight: 41` vs `clientHeight: 39` at idle) before
  fixing, and confirmed the fix (`autoResize` now adds `getComputedStyle`'s
  `borderTopWidth + borderBottomWidth` to the height it sets) at four sizes after:
  empty (`41 === 41`, no scrollbar), 3 lines (`86 === 86`, no scrollbar), just under
  the 50vh cap (`311` vs cap `335`, no scrollbar), and just past it (`scrollHeight: 356`
  vs `clientHeight: 333`, scrollbar correctly appears).

### Verification (real browser + DOM measurement, not just code review)

- Two-bar layout: loaded a saved resume and a saved cover letter from the Saved tab in
  turn — confirmed each landed on its own tab with content and the action-button row
  at the top; confirmed the Job Description tab correctly showed only the
  not-yet-generated Generate button for whichever type was still missing, and flipped
  to the read-only reference view once both existed; ran one real end-to-end
  `/generate` call through the new button (not just saved-item loading) and confirmed
  "Generating..." → rendered content; confirmed "Generate for new job" fully resets
  from multiple starting tabs, including from the Saved tab itself.
- Polish round: screenshot-verified the stone top bar, tightened padding, and coral
  Roboto Mono logo; verified the tab-row divider across three tab states (Job
  Description, Saved, generated Resume); computed and cross-checked the WCAG contrast
  numbers above with a small Python script rather than eyeballing; measured the
  auto-growing textarea's actual rendered height against `window.innerHeight` (335px
  at a 670px viewport, exactly 50vh) and confirmed `overflow-y: auto` plus a
  `scrollHeight` that genuinely exceeded `clientHeight` only past the cap.
- `tsc --noEmit` and `eslint` both clean throughout.

Committed on `redesign/application-workspace` across three commits: `374312c`
(two-bar layout), `6498546` (top-bar polish + divider), `a822a62` (auto-growing chat
input). Not merged to `main`.

## Feature: Wire Saved tab, Save button, and package loading to /applications (2026-09-17)

Full cutover from the old `/resumes` endpoint (removed entirely in backend's Phase 3,
`acb9ae5`) to the new `/applications` package storage — no parallel path kept. Backend
contract: `POST /applications` (`{name?, job_description: {raw, cleaned?}, resume?,
cover_letter?}` → full `Application`), `GET /applications` (lightweight
`ApplicationSummary[]` with `has_resume`/`has_cover_letter` flags), `GET
/applications/{id}` (full `Application`), `DELETE /applications/{id}`.

- **`app/types.ts`**: `SavedItemSummary`/`SavedItem` replaced with `JobDescription`
  (`{raw, cleaned}`), `ApplicationSummary`, and `Application`, matching the backend
  models exactly.
- **`SaveButton.tsx`**: no longer saves one document at a time against `type`/
  `document` props. Now takes the whole session's state — `jobDescription: {raw,
  cleaned}`, `resume: Resume | null`, `coverLetter: CoverLetter | null` — and POSTs it
  as one `/applications` package. A resume-only session (no cover letter generated
  yet) saves JD + resume with no forced empty CL slot, since `cover_letter` is simply
  `null` in the request body. Same prompting/confirm/cancel UX as the old per-document
  version, just a different payload and endpoint.
- **`SavedTab.tsx`**: evolved in place (not rebuilt) into the pill-per-content-type
  card design. Fetches `GET /applications` for the list; each row-card shows a Job
  Description pill (always present — every application has one), a Resume pill
  (`has_resume`), and a Cover Letter pill (`has_cover_letter`). Clicking a specific
  pill (`stopPropagation`'d against the card's own click) fetches the full
  `GET /applications/{id}` and calls `onLoad(application, thatTab)`; clicking the card
  body anywhere else does the same with `tab: 'jd'`. Delete/Confirm/Cancel also
  `stopPropagation`. Delete now calls `DELETE /applications/{id}`.
- **`page.tsx`**: added `cleanedJobDescription` state, captured from `/generate`'s
  `cleaned_job_description` field (added in backend's earlier Phase 1) on every
  successful generate call, and reset alongside everything else on "Generate for new
  job". `handleLoadSavedItem` replaced with `handleLoadApplication(application,
  targetTab)`, which hydrates the Job Description, Resume, and Cover Letter tabs all
  at once from one `Application` — each slot independently `success` or `idle` based
  on whether `resume`/`cover_letter` is present — mirroring the same
  "independent-slots, all populated together" pattern already used for
  freshly-generated content in the Phase 2 redesign, rather than introducing new
  state-management shape. Both `SaveButton` call sites (Resume tab, Cover Letter tab)
  now pass the complete session data so either one saves the same full package. The
  Job Description tab's reference view (shown once both Resume and Cover Letter
  exist) now renders `cleanedJobDescription` when available, falling back to the raw
  `jobDescription` text when it's null/empty (older data, or the rare case the model
  omitted it) — this was a quick follow-up after the initial pass shipped with the
  raw text only.

### Verification (real browser + direct API checks, not just visual)

- Loaded the pre-existing "Justworks" fixture (resume + cover letter, real cleaned JD
  from backend's own Phase 1 testing) via its Resume pill — landed on the Resume tab
  populated with the action row at the top; checked the Job Description tab and
  confirmed it showed the reference view (both exist) rendering the **cleaned** text —
  cross-checked via `curl`ing `/applications/{id}` directly first to confirm raw and
  cleaned actually differ (raw opens with "Back to jobs / Software Engineer / New
  York, New York / Apply / Who We Are..."; cleaned opens with "Software Engineer / New
  York, New York / Who We Are..." — site-chrome stripped), then confirmed the
  rendered page matched the cleaned version, not raw; checked the Cover Letter tab
  also came in populated. Confirms all three tabs hydrate from one load.
- Reset via "Generate for new job", generated a resume only (no cover letter) for a
  fresh JD, saved with no custom name — `curl`ed `/applications` and confirmed
  `has_resume: true, has_cover_letter: false`; confirmed the Saved-tab card showed
  only the Job Description and Resume pills, no Cover Letter pill.
- Clicked that card's body (not a pill) — correctly defaulted to the Job Description
  tab, JD populated, and correctly showed only "Generate Cover Letter" (resume already
  exists for the loaded package).
- Deleted that package via Delete → Confirm — verified gone both in the UI and via a
  follow-up `curl`.
- Generated a Cover Letter on top of the still-loaded resume, saved again with a
  custom name ("Fintech QA Role") — `curl`-confirmed both flags true and the name
  matched exactly; confirmed all three pills rendered; clicked the Cover Letter pill
  specifically (as opposed to the card body or the Resume pill) and landed correctly
  on the Cover Letter tab. Deleted the test package afterward so only the original
  fixture remained.
- `tsc --noEmit` and `eslint` clean throughout.

Committed as `b6f9a4c` on `redesign/application-workspace`. Not merged to `main`.

## Feature: Toast notifications, icons, hamburger menu, Profile view (2026-09-17)

Continuation of the `redesign/application-workspace` branch — several small-to-medium
UI passes, each requested and verified separately, landed here as four commits.

### Toast notifications (`app/components/Toast.tsx`)

Small reusable mechanism, not a one-off: a module-level `toasts` array + subscriber
list, `showToast(text, variant?, duration?)` any component can call directly (no
Context/Provider needed), and a `<ToastContainer/>` mounted once at the page root that
subscribes and renders — fixed bottom-right, stacks multiple toasts, `'success'`/
`'error'` variants using the existing `--success`/`--danger` tokens, 2.5s auto-dismiss.
`SaveButton.tsx`'s inline fading "Saved!" span was replaced with `showToast('Saved!')`
on successful save; no other existing inline message was a good fit for the same
treatment (the rest are error-styled, not success).

**Bug found and resolved during verification, worth recording**: the toast appeared to
not work at all on the first several tries. Traced it to live-editing `Toast.tsx`
(adding temporary debug logging, changing the duration) *while the page was already
loaded* — Turbopack Fast Refresh re-executes a changed module's top-level state
(resetting the `toasts`/`listeners` arrays) without necessarily remounting an
already-mounted component that captured a reference to the old array, so the mounted
`ToastContainer` was listening on a stale array while `showToast` (from the
freshly-swapped module) wrote to a new one. Confirmed via a temporary console.log that
`ToastContainer`'s mount effect only registers a listener on a genuine fresh page load,
not mid-edit. Dev-only HMR artifact from the debugging process itself, not a real bug — no code
change was needed once verification was redone on an unedited, freshly-loaded page:
clicked Save → Confirm, screenshotted at +1s (toast visible, "Saved!" in a green pill
bottom-right, Select/Edit/Save/Download buttons all in their exact original
positions) and again at +4s (toast gone on its own, no residue, no layout shift at
either point).

### Favicon, Save/Download icons, Save popover (`app/icon.svg`, `app/components/icons.tsx`, `SaveButton.tsx`, `DownloadButtons.tsx`)

- `app/icon.svg`: minimal coral document icon (folded top-right corner, two cream
  lines suggesting text), replacing the default create-next-app `favicon.ico`. Checked
  `node_modules/next/dist/docs` first per `AGENTS.md` — this version's `icon` file
  convention accepts `.svg` directly, no build step needed. Verified via
  `document.querySelectorAll('link[rel*="icon"]')` that exactly one correct `<link>`
  tag is generated, no leftover favicon reference.
- `app/components/icons.tsx`: hand-drawn `SaveIcon` (floppy disk) and `DownloadIcon`
  (arrow into a tray), simple stroke-based SVGs using `stroke="currentColor"` so they
  automatically match each button's existing text color — no icon library added for
  these two (Lucide was later added for the hamburger menu, see below; swapping these
  two to Lucide equivalents was floated as an optional consistency pass but
  deliberately left alone, they work fine as-is).
- `SaveButton.tsx`: the inline name-input/Confirm/Cancel used to swap the Save
  button's own layout in place, which visibly shifted the neighboring Download
  buttons when it opened. Converted to an absolutely-positioned popover anchored below
  the Save button (`absolute left-0 top-full`) plus click-outside-to-close (a
  `mousedown` listener scoped to while it's open). Verified: opening it never moves
  the Select/Edit toggle or either Download button; outside-click and Cancel both
  close it cleanly with no residue.

### Hamburger dropdown menu + Profile view (`app/components/HamburgerMenu.tsx`, `app/components/ProfileView.tsx`, `page.tsx`)

Adopted two new dependencies — the first runtime deps beyond Next/React/Tailwind on
this project: `@radix-ui/react-dropdown-menu` (headless; styled entirely with the
existing Tailwind/CSS-variable theme, no new visual system) and `lucide-react` (icons).

- "Saved" removed from the flat second tab row entirely — the row is now 3 tabs (Job
  Description/Resume/Cover Letter), down from 4. It's reached only via a new hamburger
  icon placed before the "Resume Builder" wordmark, which opens a coral (`--accent`)
  Radix `DropdownMenu` with two items: "Profile" (new) and "Saved" (unchanged
  `SavedTab.tsx`, just a different entry point). Neither item is a flat tab, so no tab
  shows active while viewing either — falls out for free from `tabClass`'s existing
  `tab === t` check, no extra state needed.
- The hamburger↔X toggle is a hand-built cross-fade+rotate between Lucide's `Menu`/`X`
  icons (stacked absolutely, opacity/rotate CSS transition on a controlled `open`
  state) rather than a true line-morph, since Lucide doesn't animate between icons
  natively. Radix's built-in dismiss behavior (click-outside, Escape) closes the menu
  for free, and since `open` is controlled the icon reverts automatically whenever
  Radix closes it for any reason.
- `app/components/ProfileView.tsx`: fetches `GET /profile`, renders it as raw JSON in
  a `<pre>` — deliberately unstyled placeholder, matching how earlier phases of this
  project started with raw JSON dumps before a styling pass. Used the same
  lazy-initializer pattern as `SavedTab.tsx` for the missing-`NEXT_PUBLIC_API_URL`
  case (setting error state synchronously inside the effect body tripped the
  `react-hooks/set-state-in-effect` eslint rule; matched the existing codebase
  convention instead of suppressing it).
- Verified: hamburger fully morphs to X and the coral dropdown opens on click;
  "Profile" shows real data from a live `/profile` call (name, email, links — not a
  stub) and closes/reverts correctly; "Saved" behaves identically to before, just
  relocated; click-outside and Escape both close the menu and revert the icon;
  switching to a flat tab afterward restores its active highlight correctly.

### Dropdown scroll-lock and gutter-color fixes, checkpoint (`app/globals.css`, `HamburgerMenu.tsx`)

Two related fixes, both verified, though the second is a known-incomplete checkpoint
(see "Known follow-up" below):

- `DropdownMenu.Root` got `modal={false}` — the user wants the page to stay scrollable
  while this small 2-item nav menu is open, not scroll-locked like a blocking dialog.
- Radix's default modal behavior locks body scroll and compensates with `padding-right`
  on `<body>` to prevent a width jump when the scrollbar disappears — but the top bar
  isn't itself scroll-locked/compensated, so a color gap appeared alongside it whenever
  the dropdown opened. First fix: `scrollbar-gutter: stable` on `html`, so the
  scrollbar's space is always reserved and hiding it never changes available width at
  all — this itself fully solves the *layout shift*, but exposed a second, narrower
  problem: the permanently-reserved gutter strip belongs to `html`'s own box, not any
  descendant's constrained content width. Confirmed by direct measurement (a probe
  `div`, `getBoundingClientRect`) that both `100vw` and `position:fixed;left:0;right:0`
  resolve *smaller* than the true viewport once `scrollbar-gutter: stable` is active in
  current Chrome — neither classic full-bleed trick can reach into that space. Fixed
  by giving `html` itself a hard-stop `background: linear-gradient(...)`: stone
  (`--topbar-bg`) for the top bar's measured height (~69px), cream (`--background`)
  below — since `html` is the actual scrolling element, this gradient is anchored to
  the *document's* top regardless of scroll position, so it reads as part of the top
  bar everywhere and reverts to cream past it, with no JS.
- Verified: `elementFromPoint()` at the exact gutter pixel returns `null` (nothing
  renders there but `html`'s own background) at two window widths (1191px, 900px);
  scrolled a genuinely tall page (`scrollHeight: 2531`) 500px down with the dropdown
  open, confirmed both that the page actually scrolled and that the dropdown (`[role=
  "menu"]`) stayed open and correctly positioned the whole time; `document.body
  .paddingRight` stayed `0px` throughout, confirming no scroll-lock compensation ever
  fires; click-outside/Escape/item-selection all still close the menu correctly with
  `modal={false}` (click-outside also correctly lets the same click pass through to
  the page underneath in one motion, confirmed it simultaneously selected a resume
  field — the intended non-modal behavior).

**Known follow-up, in progress, not yet built**: the gradient-based fix above still
left a visible gap in practice per the user's own check, and the decided direction is
more structural — stop `html`/`body` from scrolling at all (`height: 100%`/`100vh` +
`overflow: hidden`), and give an inner content wrapper below the top bar its own
`overflow-y: auto` instead, so the top bar is never adjacent to a scrolling context
that needs gutter reservation in the first place. That removes the need for
`scrollbar-gutter`/the gradient hack entirely rather than continuing to patch around
it. Not done as of this entry — captured here so the gradient-based commit below is
understood as a checkpoint, not the final state.

### Verification summary

`tsc --noEmit` and `eslint` (full project) clean after every commit in this batch.

Committed on `redesign/application-workspace` across four commits: `fdbf03a` (toast
system), `77f22f3` (favicon/icons/popover), `abbb2f9` (hamburger menu + Profile view +
Radix/Lucide adoption), `7b451fe` (scroll-lock + gutter-color checkpoint). Not merged
to `main`.

## Fix: Replace scrollbar-gutter/gradient hack with a non-scrolling html/body (2026-09-17)

Follow-up to the previous entry's "Known follow-up, in progress" note — the
gradient-based gutter-color fix still left a visible gap in the user's own check, and
the decided direction was structural rather than another patch: stop `html`/`body`
from scrolling at all, and give an inner content wrapper its own scrollbar instead, so
the top bar is never adjacent to a scrolling context that needs gutter reservation in
the first place. This eliminates the whole bug class rather than continuing to fight
it.

- **`app/layout.tsx`**: `html` gets `overflow-hidden` (already had `h-full`); `body`
  changed from `min-h-full` to `h-full overflow-hidden`. Neither element can ever
  scroll now.
- **`app/page.tsx`**: the root wrapper is `h-full flex flex-col items-center
  overflow-hidden` (previously no height/overflow control at all). `main` — the
  actual content area — is `min-h-0 flex-1 overflow-y-auto`, making it the one and
  only scrolling element on the page. The `min-h-0` is load-bearing: without it, a
  flex-1 item won't shrink below its content's natural height in Chrome/Firefox,
  which would silently defeat the internal scrolling and let content overflow the
  parent instead of scrolling within `main`. The top bar sits above `main` as an
  ordinary non-growing flex-column sibling, structurally never inside a scrolling
  context.
- **`app/globals.css`**: removed `scrollbar-gutter: stable` and the `html` background
  gradient entirely — no longer needed once `html` never scrolls.

**Regression found and fixed during verification** (not part of the original ask, a
side effect of the restructure): `RevisionChat.tsx`'s `sticky bottom-0` bar used to
stick flush to the window's bottom edge when `body` was the scroll container (no
padding there). Once `main` (which has its own `py-8`) became the scroll container,
its bottom padding blocked the sticky bar from reaching the true bottom — measured a
consistent 36px gap, with resume/JD text visibly peeking through below the chat bar.
First tried a negative `-mb-8` margin on the sticky element itself (mirroring the
existing `-mx-16` horizontal-bleed trick already used there) — empirically this had
**zero** effect on the gap; Chrome's sticky-bottom clamp calculation appears to ignore
the sticky element's own margin for this case, contradicting the spec-reading
expectation. Reverted that and fixed it at the actual source instead: `main`'s bottom
padding (`pb-8`) is now conditional on a `showingRevisionChat` flag — applied normally
for Job Description/Saved/Profile views, omitted when the sticky chat bar is present
so its own internal padding provides the flush-to-edge breathing room instead.

### Verification (direct DOM measurement, not just visual inspection)

- `document.documentElement.clientWidth === window.innerWidth` held in every check —
  confirms no scrollbar/gutter discrepancy exists anywhere anymore, at two window
  sizes tested.
- `elementFromPoint()` at the top bar's right edge now returns the bar's own `DIV`
  (previously returned `null`, meaning only `html`'s background painted there) — its
  own box genuinely reaches the true viewport edge, no background-painting trick
  needed.
- Loaded a long resume (`main.scrollHeight` over 2400px), confirmed `main` scrolls
  internally while the top bar stays completely static and fully stone-colored.
- Measured `main.getBoundingClientRect().bottom - chatBar...bottom` = exactly `0` on
  both the Resume and Cover Letter tabs after the padding fix (was 36px before);
  confirmed the Job Description tab (no chat bar) still retains its normal bottom
  breathing room via the same measurement approach plus a scroll-to-bottom screenshot.
- Hamburger dropdown, toast, and Save popover all confirmed unaffected — screenshot
  showed the dropdown still opening flush under the top bar even after scrolling
  `main` deep into a long resume (Radix portals its content straight to
  `document.body`, entirely outside the new scroll structure; the toast's `fixed` and
  Save popover's `absolute` positioning are likewise independent of it).
- Grepped the whole `app/` tree for `window.scroll`/`document.body.scroll`/
  `scrollIntoView`/explicit `position: fixed` — nothing else in the codebase makes a
  window-level-scroll assumption this change could break.
- `tsc --noEmit` and `eslint` (full project) clean.

Committed as `c57fdca` on `redesign/application-workspace`. Not merged to `main`.

## Feature: Save updates the loaded package in place instead of always creating a new one (2026-09-17)

Backend added `PUT /applications/{id}` (same body shape as `POST`, returns the full
updated `Application`, 404 if missing, `null` resume/cover_letter deletes that content
server-side including its docx snapshot, `updated_at` bumped while `created_at` is
preserved). Frontend wired this in so re-saving an already-loaded package updates it
instead of creating a duplicate — previously every Save was an unconditional `POST`.

- **`app/types.ts`**: added `updated_at: string` to `Application`, since the backend
  now always includes it.
- **`app/page.tsx`**: new `loadedApplication: {id, name} | null` state tracks which
  package (if any) is currently checked out. Set by `handleLoadApplication` (first
  statement, before the existing per-tab hydration), cleared by
  `handleGenerateForNewJob` (first statement, before the existing resets). New
  `handleSaved(application)` handler sets it from whatever `SaveButton` just
  saved/updated, passed to `SaveButton` as its `onSaved` prop at both call sites
  (Resume tab, Cover Letter tab) alongside `applicationId={loadedApplication?.id ??
  null}` and `initialName={loadedApplication?.name ?? ''}`.
- **`SaveButton.tsx`**: new `applicationId`/`initialName`/`onSaved` props. `isUpdate =
  applicationId !== null` drives everything: `PUT /applications/{id}` vs
  `POST /applications` (identical body either way — the same full-session payload
  already being sent), the trigger button's label ("Update" vs "Save"), the popover's
  name input pre-filling from `initialName` instead of always starting blank, the
  confirm button's loading label ("Updating..." vs "Saving..."), and the toast text
  ("Updated!" vs "Saved!"). On success, `onSaved(application)` is called with the
  parsed response — this is what makes a *second* save in the same session (including
  right after a fresh POST-created save, with no reload or navigation) correctly PUT
  the just-created package instead of creating a duplicate, since the returned id/name
  flow straight back into `loadedApplication`.
- `tsc --noEmit` and `eslint` both clean.

### Verification (real browser + direct API checks)

Requested explicitly since this is update-vs-create logic, not a visual tweak: load a
package, edit something, save, confirm via `GET /applications` that no duplicate was
created and the existing one now reflects the change.

- Pre-state: `GET /applications` showed exactly one record (the "Justworks — Software
  Engineer" fixture).
- Loaded it via the Saved tab's Resume pill — Save button correctly read "Update"
  (screenshot-confirmed), validating `applicationId` flows through the load path.
- Switched to Edit mode, appended " PUT-TEST" to the resume name field, committed it.
- Clicked "Update" — popover pre-filled with "Justworks — Software Engineer" (not
  blank, per the pre-fill requirement). Confirmed. Toast read "Updated!".
- `GET /applications` afterward: still exactly one record, same id — no duplicate
  created.
- `GET /applications/{id}`: `created_at` unchanged, `updated_at` bumped to a later
  timestamp, resume name field now read "Rene Maxey-Salomone PUT-TEST" — confirms the
  existing record was updated in place, not replaced or duplicated.
- Cleanup: `PUT` the record back with the original name restored; re-verified via
  `GET` that the content was restored and still exactly one record exists.

## Feature: JD context for /revise, additional_context rename, skill-group deletion (2026-09-18)

Three small backend-driven contract changes, bundled together since all three landed
in one backend delivery.

- **`/revise` now always sends `job_description`**: `handleRevise` in `app/page.tsx`
  sends `cleanedJobDescription || jobDescription` as a sibling field alongside
  `selected_ids`/`instruction`/`resume`/`cover_letter`, in both the resume and
  cover-letter branches (one shared request body, no branch duplication needed). Fixes
  a real bug: revise instructions referencing the job description (e.g. "remove skill
  groups not relevant to this role") previously 502'd since `/revise` never had JD
  context to work with.
- **`company_context` → `additional_context` rename**: request field to `/generate`,
  local state (`companyContext`/`setCompanyContext` → `additionalContext`/
  `setAdditionalContext`), and `GenerateForm`'s props/JSX all renamed consistently, no
  back-compat kept (backend no longer accepts the old name either). UI label changed
  from "Company context (optional)" to "Additional context (optional)", with a new
  placeholder describing the broader scope (company relationship, extra qualifications
  not in the profile, other free-form context) — reflects that the field was never
  just about the company.
- **Empty-text skill-group update means delete that group**: `applyRevisionUpdates` in
  `app/lib/resume.ts` — when a skill-group id's incoming `/revise` update has empty
  text (after trim), that group is now filtered out of `section.groups` entirely
  instead of being rewritten into an empty `items: []`. No separate handling needed in
  Save/Update — a group removed this way is simply absent from the next save/update's
  payload, since Save/Update already just packages up whatever currently exists in
  session state.
- `tsc --noEmit` and `eslint` both clean.

### Verification (real browser + direct `fetch`/curl checks, not just code review)

- Confirmed the "Additional context" label/placeholder render correctly on the
  Generate form, then ran a real `/generate` call with it filled in — succeeded with
  no 422, confirming the renamed field lands correctly on both sides.
- Selected a skill group ("Mobile: React Native (Expo)") and submitted a revise
  instruction telling the model to delete it outright. First attempt with a vaguer
  instruction ("this isn't relevant to the job description, remove it") returned
  `{"updates": []}` — a no-op, the model's judgment call on an ambiguous instruction,
  not a bug. A more direct instruction ("delete this entire skill group") got back
  `{"id": "skill_mobile", "text": ""}`, and the pill disappeared entirely from the
  rendered UI — confirmed via the Raw JSON panel that the group is fully gone from
  `sections[].groups`, not merely emptied.
- Selected the "Frontend" skill group and asked to "keep only the skills mentioned in
  the job description in this group" — correctly filtered down to just "React" (the
  only frontend skill the test JD mentioned), proving `job_description` is reaching
  `/revise` and actually being used. All 5 `/revise` calls made during this
  verification (2 direct `fetch` calls from the browser console plus 3 through the
  real UI) returned 200 — no 502s, including the JD-referencing ones that would have
  failed before this fix.
- Regression-checked plain bullet-level revise afterward ("make this more concise, one
  sentence") — still works correctly, only the targeted bullet changed.
- No test data was saved to `/applications` during this verification (Save was never
  clicked) — confirmed via `GET /applications` that only the pre-existing fixture
  remained, nothing to clean up.

## Feature: Undo/revert for chat-scoped revisions and manual edits (2026-09-18)

Pure frontend feature, no backend involvement — a local per-document undo stack that
gets applied before an explicit Save/Update, same as any other in-session state.

- **`app/page.tsx`**: two new state slots, `resumeHistory: Resume[]` and `clHistory:
  CoverLetter[]`, mirroring the existing per-tab state-slot pattern
  (`resumeState`/`coverLetterState`). A derived `history = tab === 'resume' ?
  resumeHistory : clHistory` follows the same pattern as `selectedIds`/`reviseState`.
  Capped at `MAX_HISTORY = 10` (oldest entry dropped first once full) via
  `pushResumeHistory`/`pushClHistory` helpers — a simple array of full prior document
  states, no partial/scoped patches, matching how revise/manual-edits already apply as
  whole-object immutable updates.
- **Every content-mutating action pushes the pre-change document onto that document's
  stack before applying the new state**: `updateResume` (covers `addBullet`/
  `removeBullet`/`addSkillItem`/`removeSkillItem`/`editSkillItem`/`addLink`/
  `removeLink`/`editLink` — all of `app/lib/resume.ts`'s mutators funnel through this
  one function already), `handleEditField` (manual scalar-field edits via
  `InlineEdit.tsx`), and `handleRevise`'s success path (both resume and cover-letter
  branches). These three call sites were rewritten from React's functional
  `setState((prev) => ...)` form to reading `resumeState`/`coverLetterState` directly
  (already safe — synchronous event-handler closures, same pattern the request-body
  construction in `handleRevise` already relied on) specifically so the pre-change
  value could be captured and pushed onto history in the same breath as applying the
  new state, without nesting a `setState` call inside another `setState`'s updater.
  `handleRevise` only pushes when `data.updates.length > 0` — a no-op revise response
  (the model declining to change anything) doesn't waste a history slot on an
  identical snapshot.
- **`handleRevert`**: pops the current tab's stack (LIFO) and sets it as the current
  resume/cover-letter state. Single-direction undo, no redo, matching the simplest
  model that covers the ask.
- **Stack reset**: both `handleGenerateForNewJob` and `handleLoadApplication` now also
  clear `resumeHistory`/`clHistory` — a fresh workspace or a newly-loaded package
  makes the old undo history meaningless. **Save/Update does not touch either
  stack** — confirmed this was intentional per the spec (a save is a snapshot upload,
  not an undo checkpoint) and verified it holds in practice.
- **`app/components/RevisionChat.tsx`**: new `canRevert`/`onRevert` props. A
  `Undo2` (lucide-react, already a project dependency since the hamburger-menu pass)
  icon button sits between the textarea and the Revise submit button, `type="button"`
  so it can't trigger the form's submit, disabled when `canRevert` is false. Placed
  inside the sticky chat bar rather than the Select/Edit top action row because that
  bar is already rendered unconditionally regardless of `previewMode` (confirmed by
  reading `page.tsx`'s JSX — `RevisionChat` sits below `ResumePreview`/
  `CoverLetterPreview` in both Select and Edit mode, not hidden in either), so it's
  reachable regardless of which mode manual edits vs. chat revisions happen in without
  needing a second copy of the control.
- `tsc --noEmit` and `eslint` both clean.

### Verification (real browser, this is state/logic correctness — not CSS)

- Selected a bullet, submitted a chat-scoped revise ("make this more concise, one
  sentence") — bullet text changed, revert button went from disabled to enabled.
  Clicked revert: bullet text came back byte-for-byte identical to the pre-revise
  version (confirmed via the Raw JSON panel), and the button went back to disabled
  since the stack was empty again.
- Switched to Edit mode, manually edited the resume name field (appended " Jr."),
  clicked revert — name reverted to the exact pre-edit value. Confirms the revert
  control (living in the always-rendered chat bar) is reachable and functional from
  Edit mode, not just Select mode.
- Chained three manual edits to the same field (appended "-A", then "-B", then "-C"
  in three separate edits) and reverted three times in a row: each click removed
  exactly one suffix in reverse order (`...-A-B-C` → `...-A-B` → `...-A` →
  original), confirming LIFO step-by-step behavior rather than jumping straight back
  to the original or losing intermediate steps.
- Made one more manual edit, then clicked **Update** (save) — confirmed via direct
  DOM inspection that the revert button was still enabled (not disabled) immediately
  after the save completed, i.e. Save/Update does not clear the stack. Reverted after
  the save and confirmed the pre-edit content came back correctly, then re-saved to
  leave the fixture clean.
- Made a manual edit (unsaved), then reloaded the same package via the Saved tab —
  confirmed the revert button was disabled afterward, i.e. loading a package resets
  the stack (didn't get a chance to test against a genuinely *different* second saved
  package since only one fixture exists in this environment, but the reset code path
  is identical regardless of which package is loaded).
- Cleanup: the one test edit that was actually persisted via Update mid-verification
  was saved back to its original value before finishing; `GET /applications`
  confirmed exactly one record remains with the original name intact.

## Feature: "Current Application" top-bar button, hide second tab bar on Profile/Saved (2026-09-18)

Two small layout/visibility changes to `app/page.tsx`.

- **"Current Application" button**: sits left of "Generate for new job" in the top
  bar's right-aligned button group (both now wrapped in one `flex items-center
  gap-3` div, so the existing three-column `justify-between` layout — logo,
  backend-status text, button group — stays intact rather than fighting a fourth
  top-level flex child). Rendered only when `loadedApplication !== null` — the same
  state already used to decide PUT vs POST in `SaveButton`. Label is the literal
  text "Current Application", per the spec, not the loaded package's actual name.
  Clicking it does `setTab('jd')`. Deliberately **not** re-fetching/re-hydrating via
  `handleLoadApplication` the way a Saved-tab card click does — the application's
  data is already the live session state (`jobDescription`/`resumeState`/
  `coverLetterState` all reflect whatever's currently loaded, possibly including
  unsaved edits or revisions), so re-fetching would silently clobber anything not
  yet saved. Only the "land on the Job Description tab by default" convention was
  reused, not the fetch-and-overwrite behavior — flagging this interpretation since
  the request's wording could be read either way.
- **Second tab bar (Job Description/Resume/Cover Letter) + its divider now hidden
  entirely on Profile and Saved**: new `isContentTab = tab === 'jd' || tab ===
  'resume' || tab === 'cover_letter'` derived value gates the tab-row `<div>` (was
  previously always rendered). Also replaced the existing `tab !== 'saved' && tab
  !== 'profile'` check further down (guarding the three tabs' actual content) with
  the same `isContentTab`, removing a duplicated equivalent condition.

### Verification (real browser + DOM inspection, not just visual)

- Fresh session (no package loaded): confirmed "Current Application" does not
  render at all.
- Loaded the Justworks fixture via the Saved tab: button appeared immediately, and
  stayed visible while navigating to Profile and Saved (since a package remains
  loaded regardless of which view is active).
- From Profile, clicked "Current Application" — landed on the Job Description tab
  showing the loaded package's actual (cleaned) JD text, not a blank/default form.
  Repeated from the Saved tab with the same result.
- Clicked "Generate for new job" — button disappeared again, confirming it tracks
  `loadedApplication` correctly in both directions.
- Confirmed via `document.querySelectorAll('button')` that no "Job Description" /
  "Cover Letter" tab button exists in the DOM at all while viewing Profile —
  genuinely absent, not CSS-hidden. Visually confirmed the same for Saved, and
  confirmed the tab row + divider are present and functional on all three content
  tabs.
- No test data touched `/applications` during this verification — confirmed via
  `GET /applications` that only the original fixture remains.
- `tsc --noEmit` and `eslint` both clean.

## Feature: Profile editing UI, replacing the raw JSON dump (2026-09-18)

Full design in `TODO.md`'s "Profile editing UI" entry. Backend delivered
`Profile.summary_pool: list[SummaryGroup]` (was a flat `list[str]`, migrated to
`{id, role_type, summaries: [{id, text}]}`, mirroring `SkillGroup`'s shape) and
`POST /revise` accepting `profile: Optional[Profile]` as a third mutually-exclusive
option alongside `resume`/`cover_letter` (400 if not exactly one is present),
never forwarding `job_description` for profile-type revises. `PUT /profile` is
reused unchanged as the final write-to-disk step.

- **`app/types.ts`**: added `SummaryItem` (= `IdText`), `SummaryGroup`
  (`{id, role_type, summaries}`), and `Profile` (`{meta, summary_pool, sections}` —
  no `type`/`summary` fields, unlike `Resume`).
- **New `app/lib/profile.ts`**: a Profile-specific parallel to `app/lib/resume.ts`
  rather than a generic refactor of it — kept separate deliberately so this
  additive work couldn't risk regressing the already-verified Resume/CL revise
  logic. `applyProfileRevisionUpdates` patches meta fields, section entries/
  bullets/skill-groups exactly like Resume's version (including the
  empty-text-deletes-the-group rule for skill groups, per the explicit instruction
  that existing skill-group rules carry over unchanged), plus a new step patching
  `summary_pool` group items directly by id — no comma-splitting and no
  delete-on-empty for summary items, since each one is a full paragraph, not a
  comma-separated skill list (matches the delivered contract: a role-type group id
  expands server-side into one update per summary item, each still keyed by its
  own item id, never a joined string). Also added `describeProfileSelection` and
  Profile-typed versions of `addBullet`/`removeBullet`/`addSkillItem`/
  `removeSkillItem`/`editSkillItem`/`addLink`/`removeLink`/`editLink`/
  `addSummaryItem`/`removeSummaryItem` (a dedicated `editSummaryItem` was written
  then removed — unused, since summary-item text edits go through the same
  `onEditField` → `applyProfileRevisionUpdates` path bullets already use, no
  separate handler needed).
- **New `app/components/ProfilePreview.tsx`**: adapts `ResumePreview` for
  `Profile`'s shape plus collapsible sections. Two small local header components:
  `CollapsibleHeader` (chevron + title, toggles open/closed, used for the two
  synthetic top-level groups — Meta/Links and Summary Pool — that have no real
  backend id to select) and `CollapsibleSelectableHeader` (chevron for collapse,
  wrapping the rest of the row in the existing `Selectable` so clicking the
  title/content area still selects for chat-scoped revision — used for the five
  real `Section`s, each Experience/Projects `Entry`, and each `SummaryGroup`,
  since all of those do have selectable backend ids). Collapse state is a single
  `openIds: Set<string>` covering every collapsible id (top-level sections,
  nested entries, nested role-type groups) — synthetic ids `__meta__` and
  `__summary_pool__` stand in for the two sections with no backend id of their
  own. Education/Certifications/Skills render flat (no nesting), reusing
  `ResumePreview`'s existing per-type blocks unchanged. Meta name/email/phone and
  each link are now individually wrapped in `Selectable` — a widening beyond what
  `ResumePreview` currently does (Resume's meta fields are edit-only, not
  chat-selectable), done because the Profile spec explicitly asks for
  "meta-field level" selection that Resume was never asked to support.
- **Rewrote `app/components/ProfileView.tsx`**: was a raw `fetch` + `<pre>` JSON
  dump; now a fully self-contained editing session — its own `profileState`
  (loading/success/error), `previewMode` (select/edit), `selectedIds`,
  `reviseState`, a 10-entry undo `history` stack (same push-before-mutate pattern
  as Resume/CL's, but scoped entirely to this component), `openIds`, and
  `applyState` (idle/confirming/applying/error). Deliberately **not** lifted into
  `page.tsx` the way Resume/CL state is — Profile is reached only via the
  hamburger menu, is never part of the JD/Resume/CoverLetter tab-switching flow,
  and keeping its state local means unmounting (navigating to any other view)
  cleanly discards unsaved edits with no extra logic, which is exactly the
  "no draft persistence" behavior the spec asked for. One consequence worth
  flagging: switching to another view and back to Profile re-fetches fresh from
  `GET /profile` rather than preserving in-progress edits the way switching
  between Resume/JD/Cover-Letter tabs does — not explicitly specified either way,
  and arguably the more correct behavior for unapplied changes, but flagging the
  interpretation.
  - `handleRevise` posts `{selected_ids, instruction, profile}` — no
    `job_description` key at all (not even as `undefined`), matching the backend
    contract's requirement not to send it for profile-type revises.
  - "Apply to Profile" button opens an anchored popover (same pattern as
    `SaveButton`'s) with the exact confirmation copy from the spec ("Overwrite
    your master profile with these changes?"). Confirming does `PUT /profile`
    with the current in-session profile object; on success, clears the undo
    `history` (per spec — once applied, prior undo history no longer applies)
    and shows a toast ("Applied to profile!"). Uses the `--accent` styling like
    other primary actions but distinct wording, per the "distinct from
    Save/Update" instruction — no separate visual treatment beyond the wording
    itself was requested.
  - `RevisionChat`'s existing `canRevert`/`onRevert` props (already built for
    Resume/CL) are reused as-is — no changes needed to that component.
- `page.tsx`: `showingRevisionChat` (controls whether the content wrapper's
  bottom padding is suppressed in favor of the sticky chat bar's own padding —
  see the earlier "non-scrolling html/body" fix) now also covers `tab ===
  'profile'`, since `ProfileView` renders its own `RevisionChat` once loaded.

### Verification (real browser + direct API checks — state/logic correctness, not CSS)

- Loaded the real profile via the hamburger menu: all seven sections rendered
  collapsed by default in the confirmed order (Meta/Links, Summary Pool,
  Experience, Projects, Education, Certifications, Skills).
- Expanded Meta/Links — name/email/phone/links all rendered correctly. Expanded
  Summary Pool — its two role-type headers ("DevOps", "Technician") appeared,
  both collapsed. Clicked "Technician"'s title text: it **selected** the group
  ("Editing: 1 role type") rather than expanding it, confirming the
  chevron/select separation works as designed; clicking the chevron specifically
  then expanded it, revealing both candidate paragraphs, group still selected.
- With the Technician group selected, submitted "Rewrite both of these to start
  with a strong action verb" — **both** summary paragraphs in the group updated
  in one round trip (confirms the group-id → per-item-update expansion works).
  Verified by code inspection (not network capture) that the request body never
  includes a `job_description` key.
- Clicked Revert: both paragraphs restored to their exact original text.
- Manual edit: appended " Jr." to the name field in Edit mode, then Revert —
  restored exactly. (One retry needed here — a browser viewport resize between
  actions shifted the revert button's on-screen position and the first click
  landed on the wrong element; not a bug, just stale coordinates from browser
  automation, confirmed by re-screenshotting at the new size and clicking the
  right spot.)
- Apply flow: edited the name field, clicked "Apply to Profile" — confirmation
  popover appeared with the exact spec copy. Confirmed via `curl GET /profile`
  that the name was **still unchanged on disk** at this point (popover shown,
  not yet confirmed). Clicked Confirm — toast read "Applied to profile!", the
  revert button went disabled (history cleared, per spec), and a follow-up
  `curl GET /profile` confirmed the edited name was now persisted via `PUT
  /profile`. Cleaned up by editing back to the original name and applying again.
- Navigate-away-without-applying: edited the name again (unsaved), clicked
  "Generate for new job" (unmounts `ProfileView`) without applying, and
  confirmed via `curl GET /profile` that the on-disk name was untouched — the
  unsaved edit was discarded, no draft persisted.
- Final integrity check: `curl GET /profile` after all testing confirms meta,
  both summary-pool groups' text, all link/section/entry/group counts exactly
  match the original pre-test data — nothing left behind from the test edits.
- `tsc --noEmit` and `eslint` both clean throughout.

## Fix: Lift Profile editing state into page.tsx so it survives tab switches (2026-09-18)

Follow-up to the previous entry's flagged tradeoff: `ProfileView` previously owned
its loaded profile, selection, and undo history as local `useState`, so switching
to another view and back unmounted/remounted it, discarding in-progress edits and
re-fetching fresh — unlike Resume/Cover Letter, whose equivalent state lives in
`page.tsx` and survives ordinary tab-switching. Brought Profile in line with that
pattern.

- **`app/page.tsx`**: new `profileState: ProfileLoadState` (`idle | success |
  error` — no `loading` variant, see below), `profilePreviewMode`,
  `profileSelectedIds`, `profileReviseState`, `profileHistory`, `profileOpenIds` —
  mirroring the existing `resumeState`/`resumeSelectedIds`/etc. per-tab slot
  pattern exactly. A new `useEffect` lazily fetches `GET /profile` the first time
  `tab === 'profile'` while `profileState.state === 'idle'` — fires once per
  session (successive tab visits see `profileState` already past `'idle'`, so the
  effect's guard skips the fetch, which is what makes the persistence work).
  `handleGenerateForNewJob` now also resets all six Profile slots, matching how it
  already resets Resume/CL — explicitly requested, even though Profile itself
  isn't job-specific, since "Generate for new job" resetting the whole workspace
  is the existing convention this should match.
  - **Lint note**: the effect's "no `NEXT_PUBLIC_API_URL`" branch can't call
    `setProfileState` directly — `react-hooks/set-state-in-effect` (the same rule
    noted in `SavedTab.tsx`'s original entry) flags a synchronous `setState` call
    inside an effect body. Fixed the same way that earlier case was: the missing-
    env-var **error** state comes from `profileState`'s `useState` lazy
    initializer instead, so the type only needs `idle | success | error` (no
    `loading` — the JSX shows "Loading profile..." for `idle` too, same one-line
    fallback either way) and the effect's own body never calls `setState`
    synchronously, only inside the `fetch(...).then()`/`.catch()` callbacks.
  - `showingRevisionChat` and the `tab === 'profile'` JSX branch now check
    `profileState.state === 'success'` explicitly (previously just `tab ===
    'profile'`), matching the loading/error/success three-way branch already used
    for the Resume and Cover Letter tabs.
- **`app/components/ProfileView.tsx`**: converted from an owner of local
  `useState` to a controlled component — `profile`, `previewMode`, `selectedIds`,
  `reviseState`, `history`, `openIds` are now props (setters typed
  `Dispatch<SetStateAction<T>>` so `page.tsx`'s raw `useState` setters pass
  through unchanged), plus a new `onProfileChange(profile)` prop that replaces
  every internal `setProfileState({state:'success', profile: ...})` call. All the
  handler logic (`handleRevise`, `handleEditField`, `updateProfile`,
  `handleRevert`, the add/remove mutators) stayed in `ProfileView` essentially
  unchanged — only the state's storage location moved, not the logic operating on
  it. `applyState` (the Apply-to-Profile confirm popover's own idle/confirming/
  applying/error state) was deliberately **left local**, not lifted — it's
  transient UI state for a modal-like popover, the same category of thing
  `SaveButton`'s own `saveState` already keeps local rather than lifting into
  `page.tsx`, and the spec's "loaded profile data, selection state, undo/revert
  history" wording didn't name it.
  - Also lifted (beyond the three explicitly named in the ask): `previewMode` and
    `openIds` (collapse state), given their own dedicated `page.tsx` slots rather
    than sharing Resume/CL's single global `previewMode` toggle. Reasoning: since
    `ProfileView` still fully unmounts/remounts on tab switch (same as Resume/CL),
    leaving these two local would have meant the profile data/selection/undo
    history survived correctly but the UI would still visually snap back to
    all-collapsed, Select-mode on every return visit — a confusing half-fix.
    Flagging this as a scope judgment call since it wasn't explicitly requested,
    but it directly serves the "preserves whatever edits/selections were in
    progress" goal the ask was written around.

### Verification (real browser + direct API checks — state/logic correctness)

- Selected the name field (Select mode), then switched to Edit mode and appended
  "-PERSIST" to it (pushing one undo entry). Expanded the Meta/Links section
  first, before either of those actions.
- Switched away via the hamburger menu to Saved, then back to Profile: the edited
  name ("...-PERSIST"), Edit mode, the expanded Meta/Links section, the name
  field's selected state (confirmed by switching to Select mode and seeing
  "Selected: 1 item" with the field still ring-highlighted), and the enabled
  Revert button (undo history intact) were **all** exactly as left — no re-fetch,
  no flash of "Loading profile...".
- `curl GET /profile` at this point confirmed the edit was never written to disk
  (Apply was never clicked) — persistence across tab-switching is purely
  client-side session state, not an accidental auto-save.
- Clicked "Generate for new job", then reopened Profile: everything reset — all
  sections collapsed, Select mode, name field back to its original unedited text,
  Revert button disabled. Confirmed via the Raw JSON panel that a genuinely fresh
  fetch had occurred (unedited `meta.name`), not just an in-memory reset.
- `tsc --noEmit` and `eslint` both clean. `curl GET /profile` after all testing
  confirms no residual test data on disk.

## Fix: Meta/Links and Summary Pool misaligned relative to the other 5 sections (2026-09-18)

User found via DevTools that Meta/Links and Summary Pool weren't wrapped in a
container `<div>` the way Experience/Projects/Education/Certifications/Skills
are — `ProfilePreview.tsx` had `<CollapsibleHeader .../>` and its conditional
content `<div>` sitting as bare siblings directly inside the outer preview card,
while the other 5 sections wrap both pieces in `<div key={section.id}>`. Fixed
by wrapping Meta/Links and Summary Pool in the same plain `<div>` (no className,
matching the other 5 exactly).

While verifying, found the wrapper fix closed most but not all of the visual gap
— a `p-1` on `CollapsibleHeader`'s button (used only by Meta/Links and Summary
Pool) was offsetting its chevron ~4px right of `CollapsibleSelectableHeader`'s
chevron (used by the other 5 sections, which has no padding on its own button).
Removed that `p-1` so both header types' chevrons sit at the same x-position.

### Verification

Measured every top-level section's chevron `<svg>` via
`getBoundingClientRect().left` in the browser console: all 7 (Meta/Links,
Summary Pool, Experience, Projects, Education, Certifications, Skills) now
report the exact same x-coordinate — pixel-aligned, not just visually close.
`tsc --noEmit` and `eslint` both clean.

## Fix: Section-header hover/selected styling, and whole-section select/revise for Meta/Links and Summary Pool (2026-09-18)

Two related pieces from the same batch.

- **Underline styling for the 7 top-level section headers**: `Selectable.tsx`
  gained a `variant?: "background" | "underline"` prop (default `"background"`,
  so every existing call site — bullets, entries, skill items, summary items,
  links, nested entry/role-type-group headers — keeps its current look with
  zero changes). `variant="underline"` renders an accent-colored underline
  (`decoration-(--accent) decoration-2 underline-offset-4`) instead of a
  background tint, shown on hover (transient, `select` mode only) and kept
  persistently once selected — same persistent-vs-transient convention already
  used everywhere else, just a different visual treatment. Passed
  `variant="underline"` only at `ProfilePreview.tsx`'s **7 top-level** header
  call sites (Meta/Links, Summary Pool, and each of the 5 real sections); the
  nested Entry headers (within Experience/Projects) and role-type-group headers
  (within Summary Pool) were left on the default background variant, since the
  ask was specifically about the top-level section headers, not every
  collapsible header in the tree. Added a `wrapperClassName` prop to
  `CollapsibleSelectableHeader` (`pb-1` at the 7 top-level call sites) so the
  underline has breathing room from the content below it.
- **Bug: Meta/Links and Summary Pool couldn't be selected as whole sections**.
  These two only just got wrapped in a real container `<div>` for the alignment
  fix above, but they were still rendered via the old plain, non-selectable
  `CollapsibleHeader` (removed entirely now) rather than
  `CollapsibleSelectableHeader` (used by the other 5 sections). Fixed by
  switching both to `CollapsibleSelectableHeader`, using two new synthetic ids
  (`META_SECTION_ID` / `SUMMARY_POOL_SECTION_ID`, exported from
  `app/lib/profile.ts`) — neither has a real backing id in the `Profile` schema
  the way a `Section` does, unlike Experience/Projects/etc.
  - Since the backend's `/revise` has no concept of these synthetic ids, added
    `expandSelectedIds(profile, selectedIds)` in `lib/profile.ts`: before a
    revise request goes out, `META_SECTION_ID` expands to
    `[name.id, email.id, phone.id, ...link ids]` and `SUMMARY_POOL_SECTION_ID`
    expands to every role-type group's own id (letting the backend's existing
    group→per-item expansion take over from there, the same as selecting a
    group directly already does). `ProfileView.tsx`'s `handleRevise` now sends
    `expandSelectedIds(profile, selectedIds)` instead of `Array.from(selectedIds)`
    directly.
  - **Second bug found while verifying the first fix**: even with the right ids
    reaching the backend, a link-id update never actually applied — testing a
    real revise call directly against the backend confirmed it returns
    `{"id": "link_website", "text": "Personal Site"}` correctly (the backend's
    prompt treats a link id's `"text"` as the **label**, confirmed by reading
    `services/llm.py`'s revise system prompt), but
    `applyProfileRevisionUpdates` never had a code path patching `Link` objects
    at all — only `IdText`-shaped fields (meta name/email/phone, entry fields,
    bullets, summary items) were ever patched. Fixed by patching
    `profile.meta.links` in `applyProfileRevisionUpdates`, setting `label` from
    the update's `text` when a link's id matches. Note: `lib/resume.ts`'s
    equivalent `applyRevisionUpdates` has the same latent gap for Resume, but
    it's currently unreachable there since `ResumePreview.tsx` has never made
    links individually selectable in the first place (only Profile does, per
    the original "meta-field level" selection ask) — left unfixed since nothing
    in the Resume UI can trigger it, but worth knowing about if that ever
    changes.

### Verification (real browser + direct backend checks — this is a functional bug fix)

- Selected "Meta / Links" by clicking its title text (not the chevron) —
  showed the new persistent accent underline, "Selected: 1 item", and
  "Editing: Meta/Links" in the chat bar.
- Direct `fetch` to `/revise` with the manually-expanded real ids (bypassing
  the frontend) confirmed the backend correctly returns a link-label update
  for "add the label 'Personal Site' to the website link" — but the *displayed*
  link didn't change, which is what led to finding the missing `Link`-patching
  code path above.
- After fixing `applyProfileRevisionUpdates`, re-ran the identical instruction
  through the real UI (select "Meta / Links" → type the instruction → Revise):
  the Website pill correctly updated to "Personal Site: renemsdev.com".
  Reverted afterward — pill back to "Website: renemsdev.com".
- Selected both "Meta / Links" and "Summary Pool" together — "Selected: 2
  items", "Editing: Meta/Links, Summary Pool", confirming
  `describeProfileSelection` labels the two synthetic sections correctly, not
  just silently omitting them from the count as it did before.
- Deselected Meta/Links, kept only Summary Pool selected, submitted "rewrite
  the DevOps summary to be one sentence" — the DevOps role-type group's first
  summary was rewritten into a single sentence, confirming
  `SUMMARY_POOL_SECTION_ID`'s expansion to per-group ids (and the backend's
  existing group→item expansion) works end-to-end through the real UI.
  Reverted afterward — confirmed via a direct `curl GET /profile` that the
  reverted text matches the on-disk original exactly (Apply was never clicked
  during any of this, so disk was never at risk regardless).
- `tsc --noEmit` and `eslint` both clean. Final `curl GET /profile` confirms no
  residual test data (links and summary text both match the original).

## Fix: Extend underline to role-type headers; scrollbar-gutter content-shift (2026-09-18)

Two small follow-ups.

- **`ProfilePreview.tsx`**: Summary Pool's nested role-type group headers
  ("DevOps"/"Technician") now also use `variant="underline"` (plus the same
  `pb-1` `wrapperClassName` spacing already used at the 7 top-level headers) —
  their labels are short, single-word-ish, and read cleanly underlined the same
  way the top-level headers do. Experience/Projects' nested Entry headers were
  deliberately left on the default background variant — their content
  (title/org/dates) runs much longer, so an underline wouldn't read as cleanly
  there, and this wasn't asked for.
- **`app/globals.css`**: added `scrollbar-gutter: stable` to `.app-scrollbar`
  (applied only to `main`, the actual scroll container per the earlier
  non-scrolling-html/body restructure). Fixes a content-shift bug: once enough
  sections are expanded that `main` actually needs to scroll, the appearing
  scrollbar was nudging the centered `max-w-3xl` content column left by the
  scrollbar's width, since that space wasn't reserved beforehand.
  `scrollbar-gutter: stable` reserves it unconditionally, so the column's
  x-position never changes based on whether scrolling is currently needed.
  Reasoned through, rather than a full browser-driven check, since the Claude-
  in-Chrome extension was disconnected at the time (verification below covers
  why this is safe): this is a different situation from the earlier `html`-level
  `scrollbar-gutter` attempt that caused a visible color-gap next to the top bar
  (documented in the "Dropdown scroll-lock and gutter-color fixes" and
  "non-scrolling html/body" entries above) — that bug happened because the top
  bar was a sibling *inside* the same scrolling flow as the gutter-reserving
  element (`html`), so the reserved strip cut into space the top bar also
  needed. Since that restructure, the top bar sits *outside* `main` entirely
  (an ordinary non-scrolling flex sibling above it, never inside `main`'s box),
  and `main` has no background color of its own distinct from the page's
  uniform `--background` — so a reserved-but-unused gutter strip on `main` just
  shows more of that same background color at its own right edge, with no
  adjacent element it could visually clash with the way `html`'s gutter once
  did next to the top bar.

### Verification

- `tsc --noEmit` and `eslint` clean.
- The `scrollbar-gutter` change is CSS-only reasoning, not browser-verified in
  this pass (extension was disconnected) — flagging so it gets a quick visual
  glance next time the browser tool is available, though the reasoning above
  is based on the same structural facts (main's isolation from the top bar)
  already verified with DOM measurements in the original restructure's own
  entry.

## Fix: Saved-tab card hover uses a coral border instead of a full-card tint (2026-09-18)

`SavedTab.tsx`'s card hover was `hover:bg-(--accent-soft)` (a full-card
background tint), swapped for `hover:border-(--accent)` — the card already has
a `border border-(--border)` base, so hover now just recolors that border
coral instead of tinting the whole card. Pure CSS, reasoned through rather than
browser-verified per the user's own stated preference for this kind of change.
The pill buttons (Job Description/Resume/Cover Letter) and the Delete/Confirm/
Cancel buttons keep their own separate hover treatments unchanged — only the
outer card's hover state was in scope. `tsc --noEmit` and `eslint` clean.

**Follow-up**: bumped the hover border from 1px to 2px (`hover:border-2
hover:border-(--accent)`), per a direct follow-up request, so the coral hover
state reads a bit more clearly. Note: since the card's box-sizing is
`border-box`, growing the border by 1px on hover shrinks the interior by 1px
each side rather than growing the card outward — a common, generally
imperceptible tradeoff for border-based hover effects, not something this
pass tried to fully eliminate (would require a constant-width
transparent-to-colored border trick instead, not what was asked for). Pure
CSS, reasoned through, not browser-verified.

**Second follow-up**: added a very slight background tint back alongside the
border, per a direct follow-up request — `hover:bg-(--accent-soft)/40` (the
same `--accent-soft` token from the original full-tint hover, at 40% opacity
via Tailwind's slash-opacity modifier, already used elsewhere in this codebase
for `hover:bg-white/10`). The border stays the primary hover signal; the tint
is a faint addition, not a return to the original full-intensity look. Pure
CSS, reasoned through, not browser-verified.

**Third follow-up — investigation, not a guess**: the user manually edited the
card's hover styling directly (kept the border at 1px — `hover:border-1` — and
tried the background tint at `hover:bg-(--accent-soft)/10`), and reported it
rendered as visually identical to the page background, no tint at all, even
though the border still worked. Investigated rather than just picking a bigger
number:
- `--accent-soft` in `globals.css` is a plain solid hex (`#fbe1d2`), not
  already an rgba/semi-transparent value, ruling out the "compounding
  opacity" theory.
- Fetched the actual compiled Tailwind output from the dev server and
  confirmed `hover:bg-(--accent-soft)/10` genuinely compiles to
  `background-color: color-mix(in oklab, var(--accent-soft) 10%, transparent)`
  inside an `@supports (color: color-mix(...))` block — the opacity-modifier
  mechanism itself works correctly, this isn't a Tailwind/CSS bug.
- The real cause: `color-mix(...)` composites the translucent peach against
  whatever's *behind* the card (the page's own `--background`, `#f6ecdb`),
  and `--accent-soft` (`#fbe1d2`) is tonally very close to that background —
  both light, warm, low-saturation creams. At 10% alpha the blend is close
  enough to `#f6ecdb` to read as visually identical, confirmed by rendering
  swatches at 10/20/30/40/60/80/100% directly against the real page
  background in the browser and comparing them side by side: 10–20% were
  genuinely too close to the background to register, 30% was the first level
  that read as a clear, gentle wash while still looking subtle, 60%+ started
  looking like a solid highlight again (closer to the original full-tint
  look this whole change was meant to move away from).
- Landed on `hover:bg-(--accent-soft)/30`, kept `hover:border-1` exactly as
  the user left it. Verified on the real card (not just swatches): hovering
  now shows a clearly-present but still light warm tint alongside the coral
  border, no longer indistinguishable from the page background.

**Final state, after further manual tweaks (user happy with this one)**: the
background-tint approach was dropped entirely in favor of a bottom-border
accent — `hover:border-b-2 hover:border-(--accent-hover)/60` (2px bottom
border only, in `--accent-hover` at 60% opacity, no `bg-(--accent-soft)`
class at all anymore). Committed as-is; no further investigation needed since
this was a deliberate manual design iteration, not a bug.

## Feature: Auto Apply prompt generator (2026-09-18)

Full design in `TODO.md`'s "Auto Apply prompt generator" entry. Frontend-only,
as specified — no backend changes, no LLM call, pure text templating from data
already available via `GET /applications/{id}`.

- **New `app/lib/autoApplyPrompt.ts`**: `buildAutoApplyPrompt({application, url,
  extraInstructions, apiUrl})` assembles the full prompt text as a single
  string. Includes: the restated **never-submit safety rule** as the very
  first thing in the prompt (bolded, "does not get relaxed for any reason")
  and again in the numbered Steps section at the end, so it's stated
  unambiguously both up front and right where the actual fill-in actions are
  described; the entered URL and extra instructions (only included if
  non-empty); contact info (name/email/phone/links) pulled from whichever of
  `resume.meta`/`cover_letter.meta` exists (links only come from `resume.meta`
  specifically, since `CoverLetterMeta` has no `links` field — a
  `Meta | CoverLetterMeta` union naturally doesn't type-check `.links` on the
  narrower type, caught by `tsc`); which docx file(s) actually exist on disk
  for this package (`resume.docx`/`cover_letter.docx` under
  `backend/app/data/applications/{id}/`, only referencing whichever the
  package actually has); the full resume/cover-letter text content
  (formatted as readable prose/bullets, not raw JSON — so a screening
  question can be answered using this context without needing to parse a
  docx file) via two small local formatters (`formatResumeBody`/
  `formatCoverLetterBody`); the job description (raw and cleaned, both, since
  cleaned can be null/missing on older data); and a backend-reference section
  with the live `NEXT_PUBLIC_API_URL` and the exact `GET` URL to re-fetch the
  package if the automation session needs to.
- **`SavedTab.tsx`**: new "Auto Apply" button per card, styled as a bordered
  `--accent`-colored button (distinct from the pills and from Delete's danger
  styling). Clicking it opens an anchored popover — same absolutely-positioned,
  click-outside-to-close pattern `SaveButton.tsx` already uses, including the
  `containerRef` + `mousedown`-listener approach, just applied per-card via a
  single `autoApplyId: string | null` state slot (only one card's popover can
  ever be open at once, by construction, so one ref/one listener suffices
  rather than needing per-item hooks inside the `.map()`).
  - **Deliberately not routed through `handleLoadApplication`/`loadedApplication`**,
    per the manager's explicit recommendation, which I'm adopting as the final
    design: fetches `GET /applications/{id}` directly into local popup state
    (`autoApplyState`), the same pattern `SavedTab.tsx` already uses for pill
    clicks. This keeps Auto Apply a pure side-action with zero effect on the
    main workspace — no risk of clobbering unsaved JD/Resume/CoverLetter tab
    state, and confirmed in testing that the "Current Application" top-bar
    button (which only appears when `loadedApplication` is set) never appears
    as a side effect of using Auto Apply.
  - Popup fields: a required URL input (Prepare Application stays disabled
    until non-empty, never pre-filled from any stored data, entered fresh
    every time per spec) and an optional extra-instructions textarea, neither
    persisted anywhere. "Prepare Application" fetches the package, assembles
    the prompt, and swaps the popup into a read-only textarea + Copy button
    view. The X button closes at any stage (before or after generating); the
    click-outside handler does too since Cancel and X are functionally
    identical, matching the spec's "no separate close-vs-cancel distinction."
  - Copy uses `navigator.clipboard.writeText`, flips the button to "Copied!"
    for 2 seconds via `setTimeout`, and surfaces a failure inline (caught,
    shown as an error message) rather than failing silently.

### Verification (real browser + direct backend checks — functional/state logic, not a visual tweak)

- Opened Auto Apply on the real "Justworks — Software Engineer" saved
  package, entered a URL and extra instructions, clicked "Prepare
  Application" — the generated prompt (read via the textarea's actual DOM
  value, not just eyeballed) correctly included: the safety rule as the
  first paragraph, the exact URL and extra-instructions text entered,
  correct name/email/phone/all three links, both `resume.docx` and
  `cover_letter.docx` paths with the correct application id, full resume
  and cover-letter body content, both raw and cleaned job description text,
  the correct live backend URL and a working `GET .../applications/{id}`
  reference, and the never-submit rule restated a second time inside the
  numbered Steps section.
- Clicked Copy — button flipped to "Copied!" and reverted to "Copy" after
  ~2s on its own (confirms the timeout-based reset works, not just the
  initial click). Did not attempt to verify clipboard contents via
  `navigator.clipboard.readText()` — that call hung the tab for the full
  45s CDP timeout, almost certainly a blocked permissions prompt in the
  automated browser context; recovered fine afterward with no lasting
  effect on the page, but noting this as a dead end rather than a real
  bug, since the write side already showed correct success/error handling.
- Verified the X button closes the popup after a prompt was already
  generated (not just at the initial-fields stage), and that click-outside
  also closes it before generating. Confirmed clicking the "Auto Apply"
  button, and interacting inside the popover, never triggers the card's own
  `onClick` (which normally navigates to the Job Description tab) —
  `stopPropagation` on the actions wrapper handles this correctly.
- Confirmed no "Current Application" button ever appeared in the top bar
  during any of this — the main workspace's `loadedApplication` state was
  never touched, confirming the popup truly is self-contained.
- Confirmed via `curl GET /applications` that the applications list was
  unchanged (still exactly 2, the same ones from before this pass) — Auto
  Apply never writes anything, so no cleanup was needed.
- Did not test the resume-only/cover-letter-only branch (both existing saved
  packages have both) — confirmed by code review instead: `buildAutoApplyPrompt`
  guards each files/content section independently on `application.resume`/
  `application.cover_letter` being present, so a package missing one simply
  omits that section rather than emitting a broken reference.
- `tsc --noEmit` and `eslint` clean.

## Feature: Demo mode for a standalone Vercel portfolio deployment (2026-09-18)

Frontend-only, per the confirmed design — a `NEXT_PUBLIC_DEMO_MODE` env var (set
only in Vercel's project settings for that deployment; local `.env.local` is
untouched and still points at `localhost:8000`) that makes the entire frontend
run with **zero backend network calls**, using static fixtures instead, so a
public demo deployment can never cost anything or expose the API key.

### Fixture data

Real content, not an invented persona, per the user's own decision (a demo
visitor almost certainly arrived via a link from the resume/portfolio itself).
Sourced directly from the real "Justworks — Software Engineer" saved package
and the real `profile.json`:
- `app/lib/demoFixtures/application.json` — the real `GET /applications/{id}`
  response. One cleanup made to the source data before freezing it as a
  fixture: the resume summary had a leftover "This is a test line..." artifact
  from earlier testing sessions in this project — stripped it, since shipping
  that string in a public demo would look broken, not like a bug in the demo-
  mode code itself.
  `app/lib/demoFixtures/applications.json` — the corresponding `GET
  /applications` list (one entry).
- `app/lib/demoFixtures/profile.json` — the real `GET /profile` response,
  checked for the same kind of artifact and found clean.
- `public/demo/{resume,cover_letter}.{docx,pdf}` — real rendered files, not
  regenerated at runtime. The `.docx` files already existed on disk for this
  package; the `.pdf` files didn't (only `/render` generates PDFs, on demand,
  and nothing persists them), so both were generated once via a real `POST
  /render` call against the live backend as a one-time content-prep step —
  this is backend usage during *building* the demo fixtures, not something
  demo mode itself ever does at runtime.
- Skipped the optional second "Technician" track fixture (profile has one) to
  manage scope — one fixture is enough to prove the mechanism end-to-end; the
  Technician content is real and already sitting in `profile.json` if this
  gets revisited later.

### Mechanism: `app/lib/demo.ts`

`DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'`, plus typed
re-exports of the three fixtures and a `demoDelay()` helper (artificial
~700ms delay so demo Generate/chip-revise actions still show their loading
state instead of resolving instantly, which would read as broken rather than
fast).

**How the "no silent fallback" hard requirement was actually enforced**, not
just asserted: grepped every `fetch(` call site in `app/` after finishing
(13 total) and confirmed each one is either the intended demo path (a static
`/demo/...` or `/_next/...` asset, same-origin, never `NEXT_PUBLIC_API_URL`)
or sits behind an explicit `if (DEMO_MODE) return`/`if (DEMO_MODE) { ...
return }` guard before the real fetch line. Several of those guards are
technically unreachable defense-in-depth (e.g. `SaveButton`'s `handleConfirm`
can only run after its own trigger button already blocked demo mode with a
toast) — added anyway so the guarantee doesn't rely on exactly one code path
per feature being correct, matching how seriously the "never a silent
fallback" instruction was stated. Verified for real afterward in the browser
(see Verification below), not just by code review.

### Per-feature behavior in demo mode

- **Health check** (`page.tsx`): the `/health` effect never fires; the top bar
  shows a static "Demo Mode — sample data only, no live backend" banner in
  its place.
- **Profile fetch, Saved-tab list fetch**: both state initializers branch on
  `DEMO_MODE` to start directly at `{state: 'success', ...fixture}` instead of
  `'idle'`/`'loading'`, so the effects that would normally fetch never even
  see a triggering state.
- **Auto-load on mount** (`page.tsx`, new effect): calls the existing
  `handleLoadApplication(demoApplication, 'resume')` once, so a portfolio
  visitor lands on a fully populated, tailored resume immediately instead of
  a blank JD form — reuses the exact hydration a real Saved-tab click already
  does, no new state-management path. `handleGenerateForNewJob` is untouched
  and still resets to a genuinely blank JD form in demo mode too (matching
  real product behavior); Generate afterward still works (see below), so a
  visitor can experience that flow as well, not just the pre-populated view.
- **`/generate`** (`page.tsx`): after the artificial delay, always sets
  `resumeState`/`coverLetterState` to the fixture's resume/cover-letter
  regardless of what's typed in the JD/additional-context fields — no
  tailoring happens, but the loading→success UX is otherwise identical to the
  real flow.
- **`/revise` chat + suggestion chips** (`RevisionChat.tsx`, `page.tsx`,
  `app/lib/demoFixtures/revisions.ts`): `RevisionChat` gained optional
  `demoSuggestions`/`onDemoSuggestionClick` props — a row of chips rendered
  above the textarea (always enabled regardless of current selection, since
  each chip specifies its own target id(s) rather than depending on
  `selectedIds`). Three chips for Resume ("Make this bullet punchier" →
  `b_salo_4`, "Add more cloud experience" → the `skill_cloud` group,
  "Emphasize leadership" → the summary), two for Cover Letter (concise
  opening → `p1`, more enthusiasm → `p3`). Clicking one calls a new
  `handleDemoSuggestion` in `page.tsx` that runs the *exact same*
  `applyRevisionUpdates`/`applyCoverLetterUpdates` + history-push path a real
  `/revise` response already uses — only the source of the `updates` array
  differs (a hardcoded fixture instead of a fetch response), so undo/redo,
  history capping, and rendering all fall out for free with no new state
  machinery. Free-typed instructions still reach `onSubmit` as always, but
  `handleRevise`'s demo branch never calls fetch — it immediately sets an
  inline error-style message ("This demo can't run arbitrary instructions —
  try one of the suggestions above"), using the same `errorMessage` display
  `RevisionChat` already had, no new UI needed for the graceful-failure case.
- **Profile view-only** (`ProfileView.tsx`): adopted the simpler option the
  manager floated, to keep scope contained. In demo mode: the Select/Edit
  `ModeToggle` isn't rendered at all (so `previewMode` never leaves its
  default `'select'`, which also means `ProfilePreview`'s existing
  `mode !== 'edit'` branches naturally make every field read-only — no new
  prop needed there); "Apply to Profile" shows a toast ("Profile editing
  isn't available in this demo") instead of opening the confirm popover;
  `RevisionChat` isn't rendered at all for Profile in demo mode, replaced by
  a one-line sticky note ("Profile is view-only in this demo — chat-scoped
  editing isn't available here"). Click-to-select/highlight still works
  (harmless, no network, demonstrates the interaction model), just doesn't
  lead anywhere.
- **`/render` downloads** (`DownloadButtons.tsx`): demo branch fetches
  `/demo/{resume,cover_letter}.{docx,pdf}` — a same-origin static asset
  served by Next.js itself, not the backend — into the exact same
  blob-download-trigger code the real path already uses, so the two branches
  only differ in *where the blob comes from*, not in how the download itself
  fires.
- **Save/Update** (`SaveButton.tsx`): the trigger button's `onClick` shows a
  toast ("Saving isn't available in this demo") instead of opening the name
  popover, in demo mode — not explicitly named in the original 7-item list,
  but a clear and necessary extension of "zero backend dependency, no silent
  fallback" once you consider that Save writes to `/applications` just like
  everything else. Same reasoning applied to:
  - **Auto Apply** (`SavedTab.tsx`): toast ("Auto Apply is out of scope for
    this demo") instead of opening the popover — this one *was* explicitly
    named in the spec.
  - **Delete** (`SavedTab.tsx`): hidden entirely rather than toasted, since
    there's only one demo package and deleting it would break the demo with
    no real backend to restore it from — a toast telling someone "no" to an
    action that would genuinely break the page felt worse than just not
    offering it.
  - **Retry** (`SavedTab.tsx`, error-state fallback): guarded too, though
    unreachable in practice since `listState` never becomes `'error'` in
    demo mode.

### Verification (real browser, this is functional/state logic, not a visual tweak)

Getting a second `next dev` instance running against the same project
directory to test demo mode without disturbing the real running dev server
(or `.env.local`, which must stay untouched) doesn't work — Next 16 refuses a
second dev server against the same project dir even on a different port.
Used a production build instead, which is actually more representative of
the real deployment anyway (`NEXT_PUBLIC_*` vars are baked in at build time
either way): `NEXT_PUBLIC_DEMO_MODE=true npx next build`, then `next start -p
3001` alongside the untouched real dev server on 3000. Confirmed both
`.env.local` and the real dev server were unaffected before and after.

- **Network panel, the core requirement**: called `read_network_requests`
  early and again after a full pass through every feature below (chips,
  free-text, Save, Download docx+pdf, Auto Apply, Delete-hidden check,
  Profile, Generate) — zero requests to port 8000 or any `NEXT_PUBLIC_API_URL`
  origin at any point; every request was same-origin (`localhost:3001`) static
  assets (`_next/*`, `/demo/*.docx`, `/demo/*.pdf`).
- Landed on the auto-populated Resume tab on load, with the "Current
  Application" button present and the cleaned summary showing no leftover
  test-artifact text.
- Clicked all 3 Resume chips in sequence — each applied its exact scripted
  diff (verified the rendered text matched, not just that *something*
  changed): punchier bullet, appended cloud skills, leadership-emphasized
  summary. Reverted with Undo — confirmed LIFO, one diff peeled off per
  click, each intermediate state matching what preceded that specific chip
  click (not just "back to original").
- Typed free text with a section selected, hit Enter — got the graceful
  inline message, confirmed via `read_network_requests` no request fired at
  all for that submission.
- Switched to Cover Letter tab, clicked "Make the opening more concise" —
  applied correctly, independent state from the Resume tab's chip clicks.
- Clicked Save/Update — toast fired, no popover opened, no network call.
- Downloaded both `.docx` and `.pdf` for the resume — confirmed via
  `read_network_requests` that `/demo/resume.docx` and `/demo/resume.pdf`
  both returned real 200s with real file bytes (didn't verify the browser's
  own save-to-Downloads step, since this sandboxed environment doesn't
  surface that, but the fetch+blob+`<a download>` trigger is the exact same
  code the already-working real path uses).
- Saved tab: confirmed Delete is completely absent from the DOM (not just
  visually hidden) for the one demo package; clicked Auto Apply and got the
  toast, no popover.
- Profile tab: confirmed no Select/Edit toggle renders, clicking a section
  still shows the selection highlight (proving Select-mode interactivity
  survives), and "Apply to Profile" produces the toast instead of the
  confirm popover.
- Clicked "Generate for new job" — reset to a genuinely blank JD form
  (Current Application button gone too), then typed a JD and clicked
  Generate Resume for real — "Generating..." showed for the artificial
  delay, then landed on the same fixture resume, this time with the Save
  button reading "Save" rather than "Update" (correctly reflecting that this
  wasn't loaded from a package) — confirms the manual Generate path and the
  auto-load-on-mount path are both independently correct, not one propping
  up the other.
- `tsc --noEmit` and `eslint` clean across the whole `app/` directory, not
  just the touched files.

### Not done / explicitly out of scope for this pass

- The optional second "Technician" fixture, per the reasoning above.
- Actual Vercel project setup (Root Directory, env var in the dashboard) —
  confirmed out of scope for this task, a separate manual step.

---

## Fix: Profile-stranded-on-loading bug, and canned-revise redesign to a full id→refinement map (2026-09-18)

Two items from live-demo feedback after the Vercel deploy, both frontend-only.

### Bug fix: Profile permanently stuck on "Loading profile..." after "Generate for new job"

Root cause: `handleGenerateForNewJob` in `page.tsx` unconditionally did
`setProfileState({ state: 'idle' })`. In demo mode `profileState` only ever
reaches `'success'` via the one-time `useState` initializer — the `/profile`
fetch effect that would normally recover an `'idle'` state is deliberately
`if (DEMO_MODE) return`'d out — so resetting to `'idle'` had no recovery path
and permanently stranded the tab. Fixed by branching the same way the
initializer already does: `setProfileState(DEMO_MODE ? { state: 'success',
profile: demoProfile } : { state: 'idle' })`.

Audited every other `setProfileState` call site (`grep -n "setProfileState"
app/page.tsx`, 5 total) and `handleLoadApplication` for the same bug class — a
reset that's fine in the real app because a later fetch/generate call fixes
it, but has no recovery path in demo mode. No other instance found: the two
calls inside the `/profile` effect are unreachable in demo mode (the effect
itself returns early), and the `onProfileChange` callback passed to
`<ProfileView>` always transitions straight to `'success'`, never to a
stranding state. `handleLoadApplication` doesn't touch `profileState` at all.

### Redesign: canned-revise chips → full id→refinement lookup, reusing the real selection+submit flow

Scope change from the user: drop the earlier plan for three fictional demo
packages; stay at one, but make it deliberately **shorter** (one Experience
entry/3 bullets, one Projects entry/2 bullets, 2 cover-letter paragraphs)
specifically so every remaining bullet — plus the summary and both cover
letter paragraphs — can have its own canned refinement, fixing the root cause
of the earlier "selection doesn't map to a canned revision" complaint (the
old curated chip set only covered ~5 ids out of a much larger real document).

Replaced `demoFixtures/revisions.ts` (curated suggestion-chip targets) with
`demoFixtures/refinements.ts` — a plain `Record<string, string>` keyed by
leaf id, one map for resume, one for cover letter. Removed the chip UI
entirely from `RevisionChat.tsx` (reverted to its pre-chip shape, no
`demoSuggestions`/`onDemoSuggestionClick` props) rather than keeping it
alongside the new mechanism, to avoid two competing interaction patterns for
the same feature. `handleRevise`'s demo branch now: after the existing
`demoDelay()`, looks up every currently-selected id in the resume/cover-letter
refinements map, builds an `updates` array from whatever's found, and runs it
through the *exact same* `applyRevisionUpdates`/`applyCoverLetterUpdates` +
`pushResumeHistory`/`pushClHistory` path a real `/revise` response already
uses — so undo, history capping, and rendering all fall out for free, same as
the old chip mechanism did. Typed instruction text is accepted but ignored
(matches the real UI's interaction model — selection drives the diff, not
free text). An id with no canned entry (skill items, links, whole
sections/entries, or nothing selected) falls through to the existing graceful
message, reworded for the new mechanism: "Nothing to refine for this
selection in the demo — try selecting a bullet or the summary/paragraph."

Rebuilt `demoFixtures/application.json` by hand to the smaller shape
described above, and regenerated `demoFixtures/applications.json` to match.
Validated the new JSON's structural correctness by round-tripping both the
resume and cover letter through the real backend's `POST /render` (all 4
docx/pdf combinations returned 200), which also produced the real matching
`public/demo/{resume,cover_letter}.{docx,pdf}` files in the same step.

### Verification (production build, same method as the original demo-mode pass)

`NEXT_PUBLIC_DEMO_MODE=true npx next build` + `next start -p 3001` alongside
the untouched real dev server on 3000; confirmed `.env.local` and the real
server unaffected before and after, and cleaned up the port-3001 process when
done.

- **Profile bug fix**: navigated to Profile (loaded correctly), clicked
  "Generate for new job" (reset to a blank JD form, as expected), navigated
  back to Profile — still shows the full fixture immediately, not stuck on
  "Loading profile...". Confirms the fix; this was the exact repro from the
  live-demo bug report.
- **Every resume bullet + summary**: selected `b1`, `b2`, `b3` (Experience)
  individually and together, then `b4`, `b5` (Projects) together while
  re-confirming the first 3 remained correct, then `summary_main` — all 6
  produced their exact canned refinement text, verified against the literal
  strings in `refinements.ts`, not just "something changed". 6 of 6 confirmed.
- **Both cover-letter paragraphs**: selected `p1` and `p2` together, submitted
  — both applied their exact canned text simultaneously.
- **Unmapped-selection fallback**: selected the whole Experience entry
  (`entry_salolabs`, not in the refinements map) and submitted — got the exact
  graceful message, no crash, no silent no-op.
- **Network audit**: `read_network_requests` after a fresh page load and after
  a `.docx` download — zero requests to `127.0.0.1:8000` or any
  `NEXT_PUBLIC_API_URL` origin; the download hit same-origin
  `/demo/resume.docx` (200), matching the original demo-mode guarantee.
- **Regression checks**: Update button still shows the "Saving isn't
  available in this demo" toast (no popover, no network call); demo banner,
  auto-load-on-mount, and the Job Description/Resume/Cover Letter tab bar all
  behaved unchanged.
- `tsc --noEmit` and `eslint` clean across the whole `app/` directory both
  right after the code changes and confirmed unchanged since.

### Known gap, flagged rather than resolved in this pass

All commits for this fix are on `profile-editing`; the live Vercel deployment
(`resi-the-builder.vercel.app`) auto-deploys from `main`. A live-site spot
check — explicitly requested as the final verification step — isn't possible
until `main` is updated, which is out of scope for this session to do
unilaterally (branch merges aren't a pathspec-scoped frontend change).
Flagged to the manager; live spot-check pending that.

---

## Feature: Demo-mode UX iteration round — single-select+pill, generate-it-yourself landing, capability banners (2026-09-18)

Three related, user-driven refinements to demo mode, done together for one
review pass on `working` (deliberately not merged/pushed to `main` yet — the
user wants to see this land before it reaches the live Vercel deploy). All
frontend-only, no backend involvement.

### 1. Single-select + suggested-edit pill (replaces free-text-triggered lookup)

Goal: make it unambiguous what a canned edit would apply to, and stop
implying the demo runs a real model on typed text.

- **`toggleSelected` (`page.tsx`)** branches on `DEMO_MODE`: in demo mode,
  clicking an unselected item replaces the whole selection (`new
  Set([id])`) instead of adding to it; clicking the sole selected item still
  toggles it off (`new Set()`). The real app's multi-select behavior is
  completely unchanged — this only affects the mutation, not
  `ResumePreview`/`CoverLetterPreview`'s click handlers, which still just
  call `onToggle(id)` either way.
- **`handleRevise`'s demo branch** is now just an early `return` — free text
  has no trigger path in demo mode. The actual apply logic moved to a new
  **`handleApplyDemoRefinement`**, called only by the new pill, which looks
  up the single selected id in `demoResumeRefinements`/
  `demoCoverLetterRefinements` and applies it through the same
  `applyRevisionUpdates`/`applyCoverLetterUpdates` + history-push path as
  before — undo/redo needed no changes.
- **`RevisionChat.tsx`** gained `demoMode`, `demoPillAvailable`, and
  `onApplyDemoRefinement` props (all optional, default off, so the real app's
  usage is untouched). In demo mode: the textarea and Revise button render in
  their normal shape but are permanently `disabled` (kept visible rather than
  removed, so the layout doesn't shift between modes); a green
  (`--success`) banner above the "Editing: ..." line explains this is
  pre-scripted, not a live AI; and a single pill ("✨ Apply suggested edit")
  appears only when exactly one item is selected and it has a mapped
  refinement — otherwise, if something's selected but unmapped, a muted "No
  suggested edit for this selection." note takes its place instead of a dead
  gap.
- Removed the "nothing to refine" error-message fallback from the old
  multi-select mechanism entirely, since an unmapped selection can no longer
  reach a submit action at all — the pill's absence already communicates
  that.

### 2. Generate-it-yourself landing flow (replaces mount-time auto-load)

Goal, per direct user feedback: showing the "AI generation" step happen
reads as a better demo than a visitor landing on an already-finished resume
with nothing to do.

- Removed the `useEffect` that called `handleLoadApplication(demoApplication,
  'resume')` on mount. The JD tab (`tab`'s actual default state) is no longer
  overridden, so a visitor now lands there.
- `jobDescription`'s `useState` initializer now reads
  `DEMO_MODE ? demoApplication.job_description.raw : ''` instead of always
  `''`, so the textarea shows a realistic, ready-to-generate JD instead of an
  empty box — no blank-page friction, no need for a visitor to have their own
  JD handy.
- `handleGenerate`'s demo branch now ends with
  `setTab(kind === 'resume' ? 'resume' : 'cover_letter')` after setting that
  type's state to `'success'`, so clicking Generate takes the visitor
  straight to what they just "generated" instead of leaving them on the JD
  tab. Generating the other type is completely untouched — each type's
  `GenerateForm` fallback still renders independently keyed off its own
  `resumeState`/`coverLetterState`, so generating only one never silently
  populates the other (this fell out for free, no new logic needed).
- **Judgment call, flagged per the ask rather than picked silently**:
  `handleGenerateForNewJob`'s reset now also re-populates the canned JD
  (`DEMO_MODE ? demoApplication.job_description.raw : ''`) instead of always
  resetting to `''`. Reasoning: since the pre-filled landing state exists
  specifically to remove empty-textarea friction, resetting to blank would
  silently reintroduce that same friction the moment someone tries the reset
  button — and since canned Generate ignores the textarea's actual content
  either way, this only changes what the visitor sees, never what re-running
  Generate produces.

### 3. Per-tab demo-capability banners (portfolio framing, distinct from #1's how-to banner)

Goal: the demo intentionally runs on canned data with no live AI, and
visitors should read that as a demo constraint, not the real product's
ceiling — distinct in purpose from RevisionChat's "how to use this demo"
banner, so implemented as a separate, stacked element rather than merged into
it.

- New **`components/DemoCapabilityBanner.tsx`** — a small reusable
  presentational component (`{ message: string }` prop, same green
  `--success` treatment as the RevisionChat banner). It doesn't check
  `DEMO_MODE` itself; each call site gates rendering with `{DEMO_MODE && ...}`,
  so the component stays generically reusable.
- Rendered once above each tab's actual content, all in `page.tsx`: Job
  Description (above the JD reference view or `GenerateForm`), Resume (above
  the `ResumePreview`/`GenerateForm` branch, stacked above RevisionChat's own
  banner when both are visible), Cover Letter (same pattern), Profile (above
  `ProfileView`/loading/error states), Saved (above `SavedTab`). Copy is
  starter text from the user's own phrasing, lightly adapted; open to a
  wording pass.

### Verification (production build, functional/interaction change)

Same method as prior passes: `NEXT_PUBLIC_DEMO_MODE=true npx next build` +
`next start -p 3001` alongside the untouched real dev server on 3000;
confirmed `.env.local` and the real server unaffected before and after,
cleaned up the port-3001 process when done.

- **Single-select**: clicking a second bullet while one was already selected
  replaced the selection rather than adding to it (confirmed via the
  highlight and "Selected: 1 item" count); clicking the same item again
  cleared it back to empty.
- **Pill mechanism**: selected `b1` (mapped) — pill appeared, clicking it
  applied the exact canned refinement; selected the whole Experience entry
  (unmapped) — pill was replaced by the "No suggested edit..." note, no dead
  gap; repeated both checks on the Cover Letter tab's `p1` with its own
  independent selection state.
- **Undo regression check**: after applying `b1`'s refinement via the pill,
  clicking Undo reverted it to the original bullet text exactly — confirms
  the history/undo path is unaffected by the new trigger mechanism.
- **Landing flow**: fresh load lands on the JD tab with the canned JD
  already filled in (not blank, not auto-loaded to Resume); clicking
  "Generate Resume" auto-switched to the Resume tab with the fixture
  content; the untouched Cover Letter tab still showed its own
  `GenerateForm` (not silently populated); generating the cover letter
  next auto-switched to that tab too; "Generate for new job" reset landed
  back on the JD tab with the canned JD re-populated, not blank.
- **Capability banners**: confirmed all five (Job Description, Resume,
  Cover Letter, Profile, Saved) render with the intended copy, in the right
  position, only in demo mode.
- **Network audit**: `read_network_requests` showed zero requests to port
  8000 across the whole pass.
- `tsc --noEmit` and `eslint app/` clean throughout.

### Not done in this pass

A fourth ask — a runtime Live/Demo toggle so demo mode can be previewed
without a separate production build, and so a curious visitor can see what
"Live" looks like — was paused by the user before implementation started
(only `layout.tsx` was read for context, no code written). Constraint from
the user once it's picked back up: the toggle must be completely absent from
the public Vercel build, not just hidden, likely by gating its existence on
the build-time `NEXT_PUBLIC_DEMO_MODE` value rather than on runtime state.

---

## Feature: Runtime Live/Demo toggle, gated so it cannot exist on the public demo build (2026-09-18)

Implements the paused toggle from the previous entry, now with a concrete
plan from the user. Hard constraint driving every design choice here: a
public demo visitor must never be able to reach real network calls through
this — not "hidden," structurally absent from that build's shipped code.

### The two-flag split

- **`app/lib/demo.ts`**: `DEMO_MODE` renamed to `BUILD_DEMO_MODE` — the raw,
  permanent, build-time value from `NEXT_PUBLIC_DEMO_MODE`, exactly as
  before. Nothing reads this to decide what to render/fetch anymore; it
  exists only to gate whether the runtime override can exist at all.
- **New `app/lib/DemoModeContext.tsx`**: `DemoModeProvider` +
  `useDemoMode()` (`{ demoMode, toggle }`). `readInitialDemoMode()` returns
  `true` unconditionally, without ever touching `localStorage`, when
  `BUILD_DEMO_MODE` is true — the override branch is skipped entirely, not
  defaulted off, so there's no code path where a public build's runtime
  state could differ from `true`. When `BUILD_DEMO_MODE` is false, it reads
  a `demoModeOverride` key from `localStorage` (`'true'`/`'false'`),
  falling back to `BUILD_DEMO_MODE` if unset or unreadable (private
  browsing, blocked storage).
- **`toggle()`** persists the flipped value to `localStorage` and calls
  `window.location.reload()` rather than flipping in-place state. Reasoning:
  nearly every `demoMode`-gated `useState` initializer and mount effect in
  this app (profile state, resume/cover-letter state, the JD prefill, etc.)
  only ever runs once per page load — an in-place flip would leave most of
  the app on the old mode until a manual refresh anyway, so a reload gets
  every consumer to a consistent state in one step instead of partially.
  `toggle()` is also a no-op when `BUILD_DEMO_MODE` is true, matching
  `readInitialDemoMode`'s guarantee.

### Hydration-safe mounting (found by testing, not anticipated)

First pass read `localStorage` synchronously in the `useState` initializer.
Locally this threw a real hydration-mismatch exception in the browser
console (Next's dev overlay flagged it as "1 Issue") whenever the persisted
override differed from `BUILD_DEMO_MODE`: `next dev`/a static prerender has
no `window`, so the server-rendered HTML always reflects `BUILD_DEMO_MODE`,
while the client's first hydration pass wanted the corrected override value
— React detected the text mismatch and discarded/regenerated the whole tree.
Fixed by gating `DemoModeProvider`'s children behind a `mounted` flag that
starts `true` immediately when `BUILD_DEMO_MODE` is true (no override
possible, so first render is already final and matches the server exactly)
and starts `false` otherwise, flipping to `true` in a mount effect that also
resolves the real `demoMode` value from `localStorage` at the same time.
This means the one render that actually depends on `demoMode` only ever
happens client-side with no server-rendered counterpart to mismatch against
— briefly showing nothing (the app's `--background` color from `body`'s own
CSS, not a white flash) instead of a discard-and-rebuild. Verified this
resolves it: reloading with an override set no longer throws, no "1 Issue"
badge, correct content on the very next paint.

### Every `DEMO_MODE` static import swapped for the hook

Mechanical rename (`DEMO_MODE` → `demoMode`, from `useDemoMode()` instead of
a static import) across `page.tsx`, `ProfileView.tsx`, `SavedTab.tsx`,
`DownloadButtons.tsx`, `SaveButton.tsx`. Safe as a pure rename rather than a
logic change because `toggle()` always reloads: `demoMode` never changes
within a session, so every existing `useState(() => demoMode ? X : Y)` lazy
initializer keeps behaving exactly as it did with the old module constant.
`RevisionChat.tsx` and `DemoCapabilityBanner.tsx` needed no changes — both
already took `demoMode`/gating as props or left it to their callers, not a
direct import. Added `demoMode` isn't a dependency array entry in the two
`page.tsx` effects and one `SavedTab.tsx` effect that reference it (guarded
`if (demoMode) return` at the top, mirroring the existing
`eslint-disable-next-line react-hooks/exhaustive-deps` pattern already used
in `InlineEdit.tsx`) — legitimate since, again, `demoMode` is stable for the
life of a page load.

### Toggle UI: `app/components/DemoModeToggle.tsx`

Checks `BUILD_DEMO_MODE` directly (not the hook's `demoMode`) and returns
`null` outright if true — this is the actual enforcement point, independent
of whatever the context computes, matching the "structurally absent, not
just hidden" requirement. Otherwise renders a small pill (`"Live mode"` /
`"Demo mode"`, `toggle()` on click), styled muted/neutral rather than the
demo banners' success-green, since it's a dev tool, not part of the demo's
own visual language.

**Positioning, found by testing rather than guessed**: the original
`bottom-4 left-4` placement collided with Next's own dev-mode indicator
badge, which also anchors bottom-left during `next dev` and is only ever
absent in production — bad for exactly the local-dev use case this toggle
targets. Moved to `bottom-20 right-4`: right side to dodge the dev badge,
and offset up from `bottom-4` to clear `ToastContainer`'s toast stack, which
anchors at `bottom-4 right-4` and grows upward.

Wrapped in `layout.tsx`: `<DemoModeProvider>{children}<DemoModeToggle /></DemoModeProvider>`.

### Verification

- **Local dev, both directions, no rebuild**: on the real dev server
  (`localhost:3000`, `BUILD_DEMO_MODE` false), clicking "Live mode" flipped
  to the full canned demo experience (banner, prefilled JD, capability
  banners) after one reload; clicking "Demo mode" flipped back to "Backend:
  ok" and real `/health` calls succeeding against the local backend — this
  is the actual benefit promised: no separate production build needed to
  preview demo mode.
- **No hydration errors** on either toggle direction after the mounted-gate
  fix — confirmed via `read_console_messages` (no hydration exception) and
  visually (no "1 Issue" badge in Next's dev overlay).
- **Public-build absence, the critical check**: `NEXT_PUBLIC_DEMO_MODE=true
  npx next build`, then grepped the actual build output — zero matches for
  `demoModeOverride` or the toggle's button text (`"Live mode"`/`"Demo
  mode"`) in either the prerendered `index.html` or the static JS chunks.
  This is a stronger guarantee than "doesn't render": the code path is
  tree-shaken out, not just skipped at runtime.
- **Defense-in-depth against a manually-set override**: on that same public
  build, manually ran `localStorage.setItem('demoModeOverride', 'false')`
  via devtools (simulating a visitor trying to force Live mode) and
  reloaded — the app stayed in Demo mode with no toggle rendered, confirming
  `BUILD_DEMO_MODE` truly short-circuits the override path rather than the
  override just defaulting the same way.
- **Regression check**: re-ran the single-select/pill mechanism (selected a
  bullet, pill appeared, applied correctly) and the per-tab capability
  banners on the public build — all still correct now that they read
  `demoMode` from the hook instead of the old constant.
- `tsc --noEmit` and `eslint app/` clean (one legitimate
  `eslint-disable-next-line react-hooks/set-state-in-effect` added for the
  mount-effect localStorage sync, and three `exhaustive-deps` disables for
  the now-hook-sourced `demoMode` in effects — same precedent as the
  existing one in `InlineEdit.tsx`).
- Killed the temporary port-3001 production server; confirmed the real dev
  server (port 3000) and `.env.local` unaffected throughout.

---

## Fix: Auto Apply opens its real popup in demo mode instead of a toast-only block (2026-09-18)

Previously `openAutoApply` blocked the popover entirely in demo mode with a
toast. Per the user, that hid useful context — changed so the popup opens
normally in demo mode, with only the actual "Prepare Application" action
still demo-gated:

- `openAutoApply` no longer checks `demoMode` at all — the popover always
  opens on click.
- Added a `DemoCapabilityBanner` inside the popup's form view (only reached
  in demo mode, since a successful "Prepare" — the `'ready'` state — is
  unreachable there) explaining what Auto Apply does in the full app.
- URL and extra-instructions fields needed no changes — they're plain
  `useState` inputs with nothing demo-unsafe about typing into them.
- **"Prepare Application" button**: kept clickable rather than disabled,
  showing the existing "Auto Apply is out of scope for this demo" toast on
  click (`handlePrepareApplication`'s `demoMode` check, previously
  documented as unreachable defense-in-depth, is now the actual trigger
  point). Chose this over disabling the button to stay consistent with
  every other "not available in demo" case in this app (Save/Update, the
  old Auto-Apply-trigger-button itself) — all toast-on-click, none disabled;
  introducing a disabled button here would've been the one inconsistent
  case rather than matching an established pattern.

**Verified live** (toggled the local dev server into Demo mode via the
Live/Demo toggle from the previous entry, no rebuild needed): popup opens
on "Auto Apply" click; banner shows; typed into both the URL and
instructions fields successfully; clicking "Prepare Application" showed the
toast, left the popup open in its form state (no spurious loading/ready
transition), and fired zero network requests (`read_network_requests`
confirmed no port-8000 calls); Cancel still closes the popup normally.
`tsc --noEmit` and `eslint app/` clean.

---

## Feature: "Current Application" button appears after a demo Generate (2026-09-18)

Ask: once either Generate button succeeds in demo mode, show the existing
"Current Application" top-bar button (already present for a truly loaded
saved package), so a visitor can navigate away and jump straight back to
what they generated.

**Deviated from the suggested implementation, and why**: the suggestion was
to reuse `loadedApplication` (set it after a demo generate, same as a real
load does) rather than add a new render condition. Traced through the
existing code first rather than assuming that round-trips cleanly:
`loadedApplication` also drives `SaveButton`'s Save-vs-Update label
(`isUpdate = applicationId !== null`), and the real (non-demo) `handleGenerate`
deliberately never sets `loadedApplication` — a freshly generated,
never-saved resume already says "Save," not "Update," and this exact
distinction was called out and regression-checked in an earlier
`STATUS_FRONTEND.md` entry ("landed on the same fixture resume ... with the
Save button reading 'Save' rather than 'Update'"). Reusing `loadedApplication`
for this would make demo mode's Generate diverge from that established,
already-tested real-app behavior just to also drive this one button.

Used a separate `demoHasGenerated` boolean instead: set `true` in
`handleGenerate`'s demo branch after either type succeeds, reset to `false`
in `handleGenerateForNewJob` (alongside the existing `setLoadedApplication(null)`).
The top-bar button's render check became
`{(loadedApplication || demoHasGenerated) && (...)}` — everything else about
the button (label, `onClick={() => setTab('jd')}`) is unchanged and doesn't
need to know which of the two conditions triggered it. `handleLoadApplication`
(the Saved-tab explicit-load path) needed no changes — it already sets
`loadedApplication`, which independently satisfies the same render check.

**Verification**: traced the full path by hand rather than a full browser
pass, per the updated verification-scope guidance — this is a single
boolean gating one render condition, with no new async/effect logic and no
interaction with anything except the two touch points above. Fresh load:
both flags false, button hidden (matches the landing-flow entry above).
Generate Resume only: `demoHasGenerated` true, button shows, persists across
tab navigation (plain component state, unaffected by `tab`). "Current
Application" click: unchanged `setTab('jd')`, independent of which flag is
set. "Generate for new job": both flags reset to their initial values,
button hidden again. `tsc --noEmit` and `eslint app/` clean.
