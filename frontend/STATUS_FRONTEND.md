# Frontend Status

Current-state reference for the frontend: what each feature area actually does today,
plus standing gotchas worth remembering. This is not a build log — for *why* the
project is shaped the way it is, see `backend/CLAUDE_CODE_CONTEXT.md` (the original
spec); for the two deployment topologies (local full-stack vs. the Vercel demo) and the
file/component map, see `ARCHITECTURE.md`; for backlog/deferred-scope items, see
`TODO.md`. This file assumes you've read `ARCHITECTURE.md` first and goes one level
deeper into feature *behavior* than that file does.

The app was built in six phases (connectivity → generate → styled preview + selection →
chat-scoped revise → cover letter mode → download), all complete; after that, every
backend gap the phases had flagged (cover-letter revise/render, section-level revise)
was closed within a day. Everything below describes the current, much-evolved state —
most sections here went through several iterations that aren't narrated individually.

---

## Generate

- Three flat top-level tabs (Job Description, Resume, Cover Letter); Profile and Saved
  are reached via the hamburger menu instead of the flat row, since neither is part
  of the generate/tailor flow. Resume and Cover Letter each have fully independent
  generate/select/revise/undo state (`resumeState`/`coverLetterState` and their
  per-tab siblings in `page.tsx`) — switching tabs never loses or resets the other
  tab's content.
- One shared `GenerateForm` component renders in three places (JD tab, and each of
  Resume/Cover-Letter tab when that type doesn't exist yet). Because it's the same
  component instance everywhere, "a Generate button disappears once that content
  exists" falls out for free from `showResumeButton`/`showCoverLetterButton` props
  driven off `resumeState`/`coverLetterState` — no separate flag-syncing.
- The Job Description tab shows a read-only cleaned-JD reference view as soon as
  *either* Resume or Cover Letter has been generated (not both) — `cleaned_job_description`
  is already set the moment either type's `/generate` call succeeds. Applies to both
  the real app and demo mode identically.
- A lightweight, intentionally-inaccurate progress bar (`components/ProgressBar.tsx`)
  sits under each Generate button and under Revise's own button — see "Progress bar"
  below.
- "Additional context" (optional field, sent to the backend as `additional_context`) —
  not just company info, any free-form context for the generation.

## Selection + chat-scoped revision

- Selectable units: bullets, whole entries, whole sections, the summary, skill groups
  (Resume); paragraphs (Cover Letter); meta fields, links, summary-pool role-type
  groups, and the two synthetic top-level groups "Meta/Links" and "Summary Pool"
  (Profile only — Resume's own meta/links are edit-only, never chat-selectable).
  Hover = transient highlight; click = persistent selection; click again = deselect;
  any mix of levels can be selected at once. Selection ids live in a `Set<string>`
  per tab (`resumeSelectedIds`/`clSelectedIds`/`profileSelectedIds`).
- `POST /revise` gets `{selected_ids, instruction, resume|cover_letter|profile}` plus
  `job_description` (resume/cover-letter only — **never** sent for a profile-type
  revise, per the backend contract). Selecting a whole section, entry, or (in Profile)
  a synthetic Meta/Links or Summary Pool group expands to real per-child ids before
  the request goes out where the backend doesn't already do that expansion itself
  (`expandSelectedIds` in `lib/profile.ts` for the two Profile-only synthetic ids).
- Responses patch back in by id via `applyRevisionUpdates`/`applyCoverLetterUpdates`
  (`lib/resume.ts`) or `applyProfileRevisionUpdates` (`lib/profile.ts`). A skill
  group's update is a comma-joined string that gets re-split into fresh
  `{id, text}` items (new ids each time — per-item ids aren't preserved across a
  group rewrite); empty text after trim deletes the group entirely rather than
  leaving an empty one.
- **Known latent gap**: `applyRevisionUpdates` (Resume) has no code path to patch a
  `Link`'s label — unreachable today only because `ResumePreview` never makes links
  individually selectable, so nothing can currently trigger it. Profile's equivalent
  (`applyProfileRevisionUpdates`) *is* patched correctly; if Resume links ever become
  selectable, patch this the same way first.
- **Undo/revert**: one stack per document (`resumeHistory`/`clHistory`/
  `profileHistory` in the relevant component, capped at 10, LIFO, single-direction —
  no redo). Every mutator (a revise that actually changed something, a manual edit, an
  add/remove on a leaf list) pushes the pre-change document first. Save/Update never
  touches the stack (a save is a snapshot upload, not an undo checkpoint); loading a
  different package or "Generate for new job" clears it.

## Inline manual editing

- One global Select/Edit toggle (`previewMode`), shared across Resume and Cover
  Letter (not per-item, not per-tab).
- Edit mode: click any scalar field — bullets, summary, meta fields, entry
  title/organization/location/dates, Cover Letter meta/salutation/sign-off/paragraphs
  — to edit it inline (`components/InlineEdit.tsx`: Enter saves, Escape reverts,
  Shift+Enter inserts a newline, blur also saves). A manual edit calls the exact same
  `applyRevisionUpdates`-family function a chat-revise response would with a
  synthetic `{id, text}` update — no separate mutation path.
- Leaf-list add/remove, edit mode only: bullets (dashed ghost row), skill items and
  links (pills — click to edit inline, hover reveals a fading ✕, trailing "+ Add"
  ghost pill). No structural add/remove (whole entries/sections) — deliberately out
  of scope. Cover Letter has no leaf-list add/remove, only scalar paragraph editing.
- **Deliberate known gap** (tracked in `TODO.md`): no manual-edit-vs-chat-revision
  provenance tracking. A manually edited field can be silently overwritten by a later
  broad chat-scoped revise, or vice versa — nothing flags or protects either
  direction. Shipped without it on purpose, to revisit only if it proves to be a real
  problem in practice.

## Profile editing (hamburger menu → Profile)

- Own preview component (`components/ProfilePreview.tsx`), 7 collapsible top-level
  groups: Meta/Links and Summary Pool (synthetic ids, no backing `Section` in the
  schema) plus the 5 real sections. Meta/Links, Summary Pool, and all 5 real section
  headers use an underline-on-select/hover treatment (`Selectable`'s
  `variant="underline"` prop); Summary Pool's nested role-type headers use it too;
  nested Entry headers (inside Experience/Projects) keep the default background-tint
  treatment — their content is longer and reads worse underlined.
- State (`profileState`, `previewMode`, `selectedIds`, `reviseState`, `history`,
  `openIds`) lives lifted in `page.tsx`, mirroring Resume/CL's per-tab-slot pattern —
  so navigating away and back preserves in-progress edits/selection/undo history
  without a re-fetch, exactly like the other tabs. Only the Apply-to-Profile confirm
  popover's own transient open/confirming/error state stays local to `ProfileView`
  (same category as `SaveButton`'s own local popover state).
- "Apply to Profile" (own button/toast, distinct from Save/Update) does `PUT
  /profile` with the current in-session profile; on success, clears undo history
  (prior undo no longer makes sense once the change is on disk).
- Unsaved profile edits are pure client-side session state — never touch disk until
  Apply is confirmed. A real page reload or "Generate for new job" discards them; a
  fresh `GET /profile` only happens once per session (or after that reset).

## Save / Update / Saved tab

- `SaveButton` posts the *whole current session* — job description + resume + cover
  letter, whichever exist — as one `/applications` package, never per-document.
- `loadedApplication` (`{id, name} | null`, in `page.tsx`) tracks which package (if
  any) is currently checked out; its presence decides `POST` (new) vs. `PUT`
  (update-in-place) in `SaveButton`, and drives that button's own label
  ("Save"/"Update"), the popover's pre-filled name, and the toast text
  ("Saved!"/"Updated!"). `onSaved()` feeds the just-saved id/name back into
  `loadedApplication`, so a second save in the same session — including immediately
  after a fresh create — correctly updates instead of duplicating.
- `SavedTab`: one card per application, up to 3 pills (Job Description always,
  Resume/Cover Letter conditional on `has_resume`/`has_cover_letter`). Clicking a
  pill loads straight into that tab; clicking the card body loads into the Job
  Description tab. Delete uses an inline Confirm/Cancel row rather than
  `window.confirm` (which blocks browser automation and is generally a worse
  confirmation pattern anyway).
- **"Current Application" top-bar button** appears whenever `loadedApplication` is
  set — real app only, via an explicit Saved-tab load or a completed Save. In demo
  mode it *also* appears once either Generate button has succeeded, via a separate
  `demoHasGenerated` flag rather than reusing `loadedApplication` — reusing it would
  have also flipped `SaveButton`'s label to "Update" after a plain demo Generate,
  since the real (non-demo) Generate flow deliberately never sets
  `loadedApplication` for a fresh, unsaved resume. Clicking the button just does
  `setTab('jd')` — it never re-fetches/re-hydrates, since that would silently
  clobber unsaved in-session edits.

## Downloads

- `DownloadButtons` posts `{resume|coverLetter, format}` to `/render` in the real
  app and triggers a real browser download from the returned blob. In demo mode it
  shows a "Downloading isn't available in this demo" toast instead (see Demo mode).

## Auto Apply

- Per-card button in `SavedTab`, own anchored popover — deliberately *not* routed
  through `loadedApplication`/`handleLoadApplication`; it fetches the package fresh
  into local popup state, so it's a pure side-action with zero effect on the main
  workspace (confirmed: using it never makes "Current Application" appear).
- `lib/autoApplyPrompt.ts` assembles a plain-text prompt for a separate
  Claude-in-Chrome session: the **never-auto-submit safety rule stated twice**
  (once up front, once in the numbered steps), the entered URL and optional extra
  instructions, contact info, which docx file(s) actually exist for this package,
  full resume/cover-letter body text (formatted prose, not raw JSON), both raw and
  cleaned job description, and a backend-reference section with the live API URL.
  No LLM call, no backend write — pure text templating from data already available
  via `GET /applications/{id}`.

## Progress bar

- `components/ProgressBar.tsx`: not an accurate estimate — a "still working, getting
  closer" signal for the two actions with no real progress events (Generate,
  Revise). Fills toward a 95%-at-`expectedDurationMs` asymptotic curve
  (`100 * (1 - e^(-elapsed/tau))`, `tau` solved so the curve hits 95% exactly at the
  expected duration), snaps to 100% and fades out on real completion. The track
  always renders at a fixed height; only its opacity toggles, so the space is
  reserved whether idle, animating, or just finished — no conditional mount/unmount.
- `GENERATE_EXPECTED_MS = 40_000` (tuned from the user's own observed timing).
  `REVISE_EXPECTED_MS = 9_000` in `RevisionChat.tsx` — **an estimate, not measured**,
  worth revisiting once there's real observed Revise timing.
- Width/alignment aren't baked into the component — a required `className` prop lets
  each call site size itself against its own layout: Generate's bars are sized to
  half the width of the wider Resume/Cover-Letter preview content column
  (`max-w-96`, confirmed equal to half of `max-w-3xl` by checking the compiled CSS,
  not assumed) and centered under a centered button row; Revise's bar is half the
  width of its own content area, left-aligned.
- Demo mode reuses the same component with no special-casing — the ~700ms artificial
  delay is far shorter than either constant's `tau`, so the bar only reaches a few
  percent before snapping to 100%, reading as a quick flash rather than a real fill.
  Accepted as-is, low-stakes given how short the demo delay already is.

## Toasts, top bar, layout shell

- `showToast(text, variant?, duration?)` + one `<ToastContainer/>` mounted at the
  page root (`components/Toast.tsx`) — a module-level array + subscriber list, no
  Context needed. Fixed bottom-right, stacks multiple toasts, 2.5s auto-dismiss.
- `html`/`body` never scroll (`overflow-hidden` on both, set in `layout.tsx`);
  `main` (`min-h-0 flex-1 overflow-y-auto` in `page.tsx`) is the *only* scrolling
  element. The top bar is a non-growing flex sibling above `main`, never inside its
  scroll context.
- Hamburger menu (`components/HamburgerMenu.tsx`, Radix `DropdownMenu` with
  `modal={false}` so the page stays interactive while it's open) → Profile / Saved.

## Demo mode

See `ARCHITECTURE.md` for the deployment-topology diagram and the build-time-flag
mechanism; this is the per-feature behavioral detail that file doesn't cover.

- `BUILD_DEMO_MODE` (`lib/demo.ts`) is the permanent build-time flag. Nothing reads
  it directly to decide what to render — every component reads `demoMode` from
  `useDemoMode()` (`lib/DemoModeContext.tsx`) instead, which is `BUILD_DEMO_MODE` on
  the public demo build (override structurally impossible there — see the toggle
  note below) or a `localStorage`-backed override anywhere else.
- **Generate**: returns the one static fixture regardless of input, after an
  artificial ~700ms delay (`demoDelay()`); the Job Description tab is pre-filled
  with the fixture's raw JD on first load and again after "Generate for new job"
  (never blank, so there's no empty-textarea friction); once a type succeeds, the
  tab auto-switches to it.
- **Revise**: single-select only — clicking an item *replaces* the current
  selection rather than adding to it (real app's multi-select is completely
  unaffected). The free-text input and Revise button are visibly present but
  permanently disabled. A single "✨ Apply suggested edit" pill (looked up in
  `demoFixtures/refinements.ts`, a plain `id → refined text` map covering every
  bullet/summary/paragraph in the deliberately small demo fixture) is the *only*
  trigger, applied through the exact same apply+history path a real revise uses; an
  unmapped or empty selection shows a muted "no suggested edit" note instead of a
  dead gap.
- **Downloads, Save/Update, Auto-Apply-Prepare**: all show a "not available in this
  demo" toast instead of doing anything real. Deliberately kept clickable rather
  than disabled, for one consistent signal across every blocked action.
- **Five `DemoCapabilityBanner` instances** (one per tab — JD, Resume, Cover Letter,
  Profile, Saved) explain what the *real* app does there — portfolio framing,
  distinct in purpose from `RevisionChat`'s own "how to use this demo" banner
  (kept as a separate, stacked element on the Resume/Cover-Letter tabs).
- **Runtime Live/Demo toggle** (`components/DemoModeToggle.tsx`, bottom-right pill):
  a local-dev (and any future non-demo-deployment) convenience only. The toggle
  component checks `BUILD_DEMO_MODE` directly and renders `null` outright on the
  public demo build — confirmed by grepping a real `NEXT_PUBLIC_DEMO_MODE=true`
  production build's compiled output for the toggle's text and its `localStorage`
  key: neither exists anywhere in the shipped HTML/JS, genuinely tree-shaken out,
  not just runtime-hidden. `toggle()` persists the flip to `localStorage` and does a
  full page reload rather than an in-place state flip, since almost every
  `demoMode`-gated `useState` initializer in the app only ever runs once per page
  load anyway.

---

## Known gaps / stale references

- See `TODO.md` for the tracked backlog (manual-edit provenance, structural
  add/remove, etc.) — not duplicated here.
- The Resume Link-patching gap and Revise expected-duration estimate above are
  implementation-state notes worth knowing, not formally tracked elsewhere.
- `ARCHITECTURE.md`'s demo-mode diagram still lists `public/demo/*.docx`/`*.pdf` as
  served static assets — stale since "Downloads no longer serve real files in demo
  mode" (downloads now toast instead, and those 4 files were deleted). Worth a
  follow-up edit to `ARCHITECTURE.md` itself.

## Lessons learned (worth checking before repeating the underlying mistake)

- **`min-h-0` on a `flex-1` scroll child is load-bearing.** Without it, a flex item
  won't shrink below its content's natural height in Chrome/Firefox, which silently
  defeats `overflow-y-auto` and lets content overflow the parent instead of
  scrolling within it.
- **A sticky-bottom element's own negative margin doesn't offset a scroll
  container's bottom padding** — empirically zero effect in Chrome, contrary to the
  spec-reading expectation (the container's own horizontal negative-margin bleed
  trick worked fine; the vertical/bottom-clamp case didn't). Fix the padding at its
  actual source (make it conditional) instead of fighting the sticky calculation.
- **`mouseenter`/`mouseleave` don't bubble**, and calling `stopPropagation()` on
  them interferes with how React's synthetic event system determines which
  ancestors get notified, causing stale/wrong "hovered" elements. Use
  `mouseover`/`mouseout` for hover-isolation logic in a nested clickable tree — they
  bubble with well-defined `stopPropagation()` semantics.
- **`scrollHeight` excludes an element's own border** (border-box sizing) — an
  auto-resize textarea that sets `height = scrollHeight` directly will sit
  permanently short by the border width, showing a phantom scrollbar even when
  empty. Add `getComputedStyle`'s border-top+bottom width to the target height.
- **`scrollbar-gutter: stable` reserves space against the scrolling element's own
  box**, not any descendant's constrained width. Applying it to an ancestor (e.g.
  `html`) when something else (e.g. a top bar) sits inside that same scrolling flow
  as a sibling can create a visible color gap next to that sibling. The durable fix
  was structural — keep the element that shouldn't be affected genuinely outside the
  scrolling context — not a bigger version of the same patch.
- **Fast Refresh can reset a changed module's top-level state without remounting a
  component that captured a reference to the old value** — editing a module (e.g. a
  toast system's module-level array + subscriber list) while the page is already
  loaded can make an already-mounted consumer listen on a now-stale reference. Reads
  as "the feature doesn't work at all." Always retest on a genuinely fresh page load
  before concluding a shared-state mechanism is broken.
- **`react-hooks/set-state-in-effect`** (this repo's eslint config) flags a
  synchronous `setState` call inside an effect body. Preferred fix: derive the value
  from a `useState` lazy initializer instead of an effect where possible. Where a
  synchronous reset genuinely can't be avoided (syncing from `localStorage` on
  mount, resetting animation state on an external prop transition), a targeted
  `eslint-disable-next-line` with a one-line justification is the accepted escape
  hatch — several precedents in the codebase (`SavedTab.tsx`, `DemoModeContext.tsx`,
  `ProgressBar.tsx`).
- **Client-only `localStorage` overrides can cause a real hydration mismatch**: if a
  component reads `localStorage` synchronously in its very first render, the
  server/build-time render (no `window`) and the client's real first paint can
  disagree, and React discards + regenerates the mismatched subtree (a console
  exception plus, in `next dev`, an overlay "1 Issue" badge). Fix pattern: gate the
  override-dependent subtree behind a "mounted" flag that starts already-`true` when
  no override is even possible (so the common case pays no extra render), and only
  delays rendering when an override could genuinely exist. The delay is a single
  frame in practice and invisible against a matching body background color.
- **A Tailwind arbitrary/utility class typo fails completely silently** — no build
  error, just missing CSS. Before trusting that a class resolves to what you expect
  (especially a non-obvious one, like `max-w-96` = 24rem), grep the actual compiled
  CSS chunk from a running dev server rather than assuming.
- **A `color-mix()`-based opacity modifier can be mechanically correct and still
  look like nothing happened** if the translucent color is tonally close to
  whatever's behind it (e.g. two similar warm creams) — a "why isn't this showing"
  bug is sometimes a color-theory problem, not a broken mechanism. Render swatches
  at several opacity levels side-by-side against the real background to find the
  threshold where it actually reads.
- **One color token usually can't satisfy WCAG AA against both a light and a dark
  background at once.** When the same semantic color needs to appear in both
  contexts, that's a signal to add a second token, not to pick one value that
  technically fails one of the two.
- **Don't assume it's safe to reuse a piece of state for a new, superficially
  similar purpose without tracing every existing consumer first** — two behaviors
  that happen to coincide in the common/original case can diverge once a new
  context (like demo mode) makes them stop coinciding.

## Verification conventions (current)

Prefer `tsc --noEmit` + `eslint` + reasoning through the code + direct network-log or
`curl` checks by default, including for most functional/interactive changes — the user
tests locally and on the live site themselves. Reserve a real Claude-in-Chrome browser
pass for changes that are genuinely hard to reason about confidently or carry real risk
if wrong (state/logic correctness with async timing, a cross-build guarantee like the
demo-toggle's build-time exclusion, or anything where the visual result itself is what's
in question). Local dev's Live/Demo toggle removes the need for a separate production
build when the thing being checked is demo-mode behavior specifically.
