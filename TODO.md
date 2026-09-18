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

- **Auto Apply prompt generator** — a "Prepare Application" flow that turns a saved
  `/applications` package into a ready-to-use instruction prompt for a separate
  Claude Code + Claude-in-Chrome session to drive the actual job-application form.
  **Frontend-only, no backend changes needed** — pure text templating from data the
  frontend can already fetch via the existing `GET /applications/{id}`, no LLM call
  involved. See the memory note on the Chrome-automation plan for the standing hard
  rule this must always restate: never auto-submit, fill only.
  - **Entry point**: each card in the Saved tab gets a new **"Auto Apply"** button
    (alongside the existing JD/Resume/CL pills and Delete). Clicking it selects that
    application and opens a popup.
  - **Popup fields**: a required **URL** text input (the actual application form's
    URL — deliberately *not* auto-filled or persisted from any stored data, since the
    JD's source page and the real application form are often different pages, and
    some applications sit behind a login/account-creation flow with no stable,
    bookmarkable URL until you're mid-session — so this is always entered fresh at
    prepare-time, the only point it's reliably known). An optional **"extra
    instructions for this application"** free-text box (e.g. a custom screening
    question to answer a specific way) — same open-ended-context idea as
    `additional_context` on the generate form, but scoped to this one automation run,
    not saved anywhere.
  - **"Prepare Application" button**: fetches the full package (`GET
    /applications/{id}`, if not already loaded) and assembles a complete prompt from:
    the JD (raw + cleaned), resume/cover-letter content including `meta`
    name/email/phone/links, the rendered docx file paths already on disk
    (`backend/app/data/applications/{id}/resume.docx` /
    `cover_letter.docx`), the package name, the entered URL, the entered extra
    instructions (if any), plus constant boilerplate: the backend base URL, explicit
    fetch/file-path instructions for the session to follow, and the restated
    never-submit safety rule. Displays the generated prompt in the popup with a Copy
    button.
  - **Popup has an X button** to close/cancel at any point — before generating (plain
    cancel) or after the prompt's been copied (done, no separate "close" vs "cancel"
    distinction needed).

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
