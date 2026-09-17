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

## Queued, small

- **Favicon**: minimal document icon — page silhouette with a folded top-right corner
  and a couple of horizontal lines suggesting text/bullets, solid coral (`--accent`)
  fill. Decided design (option 2 of 4 discussed); not built yet. Ready to start now
  that the application-workspace redesign (below) is complete.

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
