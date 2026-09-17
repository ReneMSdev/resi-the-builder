# Resume Builder — Backlog / Deferred Items

Running list of things discussed and deliberately deferred or scoped out, maintained by
the manager session as backend/frontend work progresses. Not a status report — see
[`STATUS.md`](STATUS.md) (and `backend/STATUS_BACKEND.md` / `frontend/STATUS_FRONTEND.md`)
for what's actually built and verified. Remove an item here once it's picked up and moved
into a STATUS doc as completed work.

## Deferred feature scope

- **Manual-edit protection during chat revision** — once inline manual editing ships, a
  hand-edited field could get silently overwritten if it's later swept into a broader
  chat-revision selection (e.g. hand-tune one bullet, then select the whole section and
  revise it). Decided to ship inline editing first without any tracking/protection, and
  revisit only if this proves to be a real problem in practice. When it is picked up, it
  likely means a "manually edited" flag or provenance marker alongside affected fields.
- **Structural editing** (adding/removing whole entries or sections, not just leaf items)
  — explicitly out of scope for the current inline-editing pass. Leaf-level add/remove
  (bullets, skill items, links) is in scope; entries/sections themselves are fixed.
- **`Section.title` has no stable id** — every other editable unit does (bullets, entries,
  summary, skill items, links, entry fields, meta fields, cover-letter salutation/sign-off).
  Deferred as low priority since section headings ("Experience", "Skills") rarely need
  editing. Revisit if section-title editing is ever wanted.

## Planned features (design not finalized — capturing scope before building)

- **Job application packages** — bundle the job description, resume, and cover letter
  together per job, replacing/extending today's `/resumes` save (which saves one
  document at a time with no JD attached and no link between a resume and its paired
  cover letter).
  - **Storage location: decided — inside this project** (not a separate folder outside
    the repo), since everything currently runs local-only. Likely
    `backend/app/data/applications/{id}/`, following the existing gitignored
    `saved_items/` pattern.
  - **Storage form (recommended, not yet confirmed in detail)**: real per-job files, not
    one opaque blob — JD as plain text, resume/cover letter each as both their
    structured JSON (so `/revise` can still act on them later) and a rendered docx/pdf
    snapshot. Goal: reviewable by opening files directly, and still API-queryable so a
    future Chrome-automation session can fetch "everything for job X" in one call.
  - **Save behavior**: Save should package up whatever currently exists in the session —
    JD text, resume (if generated/edited), cover letter (if generated/edited) — as one
    application, rather than requiring a separate save per document. **Decided**: if
    only a resume exists (no cover letter generated), save JD + resume as the package —
    no forced empty CL slot, no separate solo-document save path needed.
  - **Open question, not yet decided**: do the existing individual `saved_items/`
    entries get migrated into the new package model, or left as legacy/orphaned data?
  - **Loading a package** should hydrate all of its content back into the UI at once —
    JD, resume, and cover letter each into their own tab (see four-tab layout below),
    not just one document at a time like today's Saved-tab load does.
- **UI redesign: two top-level tabs (Generate / Saved) + permanent 3-tab sub-bar** —
  replaces the current Resume/Cover-Letter/Saved tab structure and the earlier
  four-tab sketch (superseded). Also **supersedes** the earlier "collapse the
  generate-input form" idea below — the input form no longer competes with the preview
  for space at all.
  - **Top-left**: static "Resume Builder" logo/wordmark in a distinctive font — no
    click/link action needed, just branding.
  - **Top-middle nav**: two tabs, **Generate** and **Saved**.
  - **Generate section**: a permanent 3-tab sub-bar — **JD / Resume / CL** — always
    present (not conditionally shown). Each sub-tab independently shows one of two
    states:
    - **Not yet generated**: shows the generate-inputs form (JD paste box, company
      context box, plus **only the Generate button(s) for content that doesn't exist
      yet**). Landing on the Resume or CL tab before that content exists shows this
      same form so you can trigger generation right from there.
      - **Decided: once a piece of content exists, its Generate button disappears
        everywhere** (JD tab and the other not-yet-generated tab), to prevent
        accidentally overwriting it. E.g. once a Resume is generated, "Generate Resume"
        is gone from the JD tab and from the (still-ungenerated) CL tab's input form —
        only "Generate Cover Letter" remains visible until CL exists too. Refining
        already-generated content happens via that tab's own select/edit/revise UI, not
        by regenerating.
      - If both Resume and CL already exist, the JD tab shows the cleaned JD with no
        generate buttons at all — it becomes a pure reference view at that point.
    - **Generated**: shows the actual content instead of the input form. Resume/CL
      tabs, once generated, show only their content plus that tab's action buttons —
      no input form, no generate button.
    - These are independent slots under one shared JD, not mutually exclusive —
      generating one shouldn't clear or affect the other (mirrors the frontend's
      existing per-mode state-slot pattern from the earlier tab-persistence fix, so
      this is more a reorganization of existing state than new state management).
    - **Action buttons (Select/Edit mode toggle, Save, Download) go at the top of the
      generated content**, not the bottom.
    - **Clear action: dropped for now, not needed** — no clear/reset button in this
      pass. Related behavior instead: **clicking the top-level "Generate" nav item
      always opens a brand-new, fully blank generate workspace** (JD/Resume/CL all
      reset to not-generated), regardless of what was previously active. **Confirmed,
      not a gap to fix**: no draft-saving/auto-recovery mechanism — navigating to
      Generate from an in-progress-but-unsaved session simply loses it. Save explicitly
      if you want to keep something.
    - **JD cleanup**: piggyback on the existing `/generate` call by having the model
      also return a `cleaned_job_description` field in the same response, rather than a
      separate dedicated "clean" endpoint — zero extra API calls/cost this way. A
      separate dedicated call would let the JD tab populate before generating anything,
      but roughly doubles call volume per job against the 50/day cap for what's mostly
      cosmetic readability — not recommended unless a pre-generate preview turns out to
      matter in practice. A non-LLM heuristic cleanup (regex/whitespace stripping) is
      free but meaningfully lower quality across arbitrary site chrome.
  - **Saved tab**: a dedicated page for browsing saved packages — a simple Drive-like
    layout, evolving today's `SavedTab.tsx` row-cards rather than a new grid from
    scratch. **Decided layout**: one rectangular bar per package, each showing clickable
    pills for whichever of JD/Resume/CL exist on that package (a package missing a CL
    just doesn't show a CL pill). Clicking a specific pill navigates to the Generate
    tab with that specific sub-tab open and populated; clicking anywhere else on the
    rectangle (not a pill) defaults to opening the JD sub-tab. Keep the existing Delete
    button and the "created" date subtext from today's `SavedTab.tsx` — no change
    needed there, just carried forward.
  - **Minor polish item, not blocking**: whether the "Generate" tab label stays static
    or dynamically shows the loaded job's company/role — default to static for now.
- **"Clear all" action** — lets the user reset current state without reloading the page
  (e.g. realizing the wrong JD was pasted). **Decided**: reverts to a fresh generate
  screen (JD/company-context inputs and any generated/edited Resume+CL content for the
  current session), but does **not** delete anything already saved.

## Infrastructure, not yet started

- **Cloudflare Tunnel** — stable hostname to expose the local backend so a Vercel-hosted
  frontend could reach it. Not started.
- **Vercel deployment** of the frontend — pushed off for now, user is happy running both
  halves locally. Depends on the tunnel above if picked back up.

## Known soft spots (not bugs, flagged for whoever touches that area next)

- **`POST /resumes` has no server-side schema validation** — `SaveRequest.data` is a loose
  `dict`, never validated against `Resume`/`CoverLetter`. Confirmed (not just assumed) that
  today's frontend save path always sends well-formed data, so this isn't an active bug —
  but nothing server-side would catch a future regression on the save path.
