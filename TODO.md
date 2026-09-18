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

## Planned feature (design confirmed — ready to build)

- **Profile editing UI**, replacing `ProfileView.tsx`'s raw JSON dump. Reuses Resume's
  existing interaction patterns rather than building something new — selection,
  chat-scoped revision, manual inline editing, undo/revert — since `profile.json`
  shares Resume's underlying schema (sections/entries/bullets/skill groups/links), just
  larger and with one extra field (`summary_pool`).
  - **Backend**: extend `/revise` to accept `profile: Optional[Profile]` alongside
    `resume`/`cover_letter`. **New, distinct system prompt** (e.g.
    `PROFILE_REVISE_SYSTEM_PROMPT`) — not the existing `REVISE_SYSTEM_PROMPT` reused
    as-is. Mirrors its structural conventions (bullet/entry/section/skill-group/
    meta-field id-expansion rules) but written specifically for profile editing: no
    job-tailoring framing (this isn't about tailoring to a role, it's maintaining
    accurate master data), includes `summary_pool`-specific handling. **Confirmed
    gap**: `summary_pool` is currently just a plain array of strings — no ids, no
    structure at all. **Migrate to grouped shape, mirroring `SkillGroup`'s existing
    `{id, label, items: SkillItem[]}` pattern**:
    `SummaryGroup { id, role_type, summaries: [{id, text}, ...] }` — `role_type` is a
    short display label (e.g. "DevOps", "Technician", "Frontend", "Backend",
    "Full-Stack") assigned per group based on reading actual content, not a
    mechanical migration. **Each `role_type` may hold multiple candidate paragraphs**,
    not just one — reuses the same leaf-list add/remove/edit conventions already
    built for skill items/links, so a second phrasing variant can be added under an
    existing Role Type later without inventing a new category. `role_type` doubles as
    the collapsed nested-header in the UI (see below).
    **`job_description` must NOT be sent** on
    profile-type revise calls — not job-tailoring, irrelevant context here. `PUT
    /profile` (already exists) is reused unchanged as the final write-to-disk step.
  - **Also fold into this same backend batch**: clarify `GENERATE_SYSTEM_PROMPT`
    (and `COVER_LETTER_SYSTEM_PROMPT` if relevant) that profile content — especially
    `summary_pool`/Role Type groups — is contextual raw material to adapt/blend for
    the job description, not a fixed menu of exact text to select verbatim. The
    "don't fabricate skills, numbers, or experience not present in the profile"
    protection already covers hard facts; what's missing is the explicit
    permission/expectation to rewrite prose content (picking the closest-matching
    Role Type as a strong starting point, not reproducing it unchanged). Today's
    prompt never mentions `summary_pool` by name at all — this has been ambiguous by
    omission, not a deliberate verbatim-selection design.
  - **Frontend**: real preview reusing/adapting `ResumePreview` + `Selectable` for
    click-to-select at bullet/entry/section/skill-group/link/meta-field level, plus a
    new `summary_pool` section (each variant selectable, same pattern as skill items).
    Chat-scoped revision via `RevisionChat` (no `job_description` sent). Manual inline
    editing via the existing `InlineEdit` components. Undo/revert reusing the 10-step
    stack pattern already built for Resume/CL — **clears after a successful Apply**
    (confirmed: once applied, the current state genuinely is the master profile, so
    prior undo history no longer applies).
  - **All edits are local only** until an explicit **"Apply to Profile"** button
    (distinct wording from "Save"/"Update" — this overwrites master data, not a
    disposable package) — clicking it shows a confirmation step before calling `PUT
    /profile`. No draft persistence if you navigate away without applying, consistent
    with how Resume/CL editing already behaves.
  - **Collapsible top-level sections**, all collapsed by default. **Confirmed order,
    top to bottom**: Meta/Links, Summary Pool, Experience, Projects, Education,
    Certifications, Skills (Summary Pool → Experience... matches `profile.json`'s own
    existing top-level key/section order; Meta/Links moved to the top per explicit
    request).
  - **Nested collapse for Experience and Projects entries**: since each entry (6
    experience, 4 project entries) carries multiple bullets, expanding the section
    itself only reveals each entry's title/org/dates header — bullets stay collapsed
    per-entry until that specific entry is clicked. Education/Certifications/Skills
    stay flat (Skills confirmed fine as-is — one compact comma-list line per group,
    nothing to gain from nesting).
  - **Nested collapse for Summary Pool too**, same pattern: expanding the section
    reveals each variant's `label` (the new job-intent category field, e.g. "DevOps",
    "Cloud", "Technician") as a collapsed header; click one to reveal its full
    paragraph text.
  - **Meta/Links reference**: `Meta` has `name`/`email`/`phone` (each `{id, text}`) plus
    a `links: Link[]` array (`{id, label, url}`) — no other fields. Editable the same
    way Resume's meta/links already are (scalar edits + leaf-list add/remove/edit).

## Queued, small

- **Consider migrating `profile.json`'s on-disk key/section order** to physically match
  the new UI display order above (Meta/Links first, then Summary Pool, then the
  existing section order) — not required for the UI itself (rendering order is a
  frontend concern independent of storage order), just for readability if someone
  opens the raw file. Not acted on, noted only.

## Infrastructure, not yet started

- **Cloudflare Tunnel** — stable hostname to expose the local backend so a Vercel-hosted
  frontend could reach it. Not started.
- **Vercel deployment** of the frontend — pushed off for now, user is happy running both
  halves locally. Depends on the tunnel above if picked back up.

## Known soft spots (not bugs, flagged for whoever touches that area next)

None open currently — the one previously tracked here (`POST /resumes` having no
server-side schema validation) was closed as a side effect of the `/applications`
redesign: `/resumes` is gone, and its replacement uses real typed
`Optional[Resume]`/`Optional[CoverLetter]` fields instead of a loose dict.
