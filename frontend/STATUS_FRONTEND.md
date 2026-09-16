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
