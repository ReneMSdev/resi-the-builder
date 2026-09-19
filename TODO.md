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

- **Consider migrating `profile.json`'s on-disk key/section order** to physically match
  the new UI display order above (Meta/Links first, then Summary Pool, then the
  existing section order) — not required for the UI itself (rendering order is a
  frontend concern independent of storage order), just for readability if someone
  opens the raw file. Not acted on, noted only.

## Infrastructure, not yet started

- **Cloudflare Tunnel** — stable hostname to expose the *real* local backend so a
  hosted frontend could reach it for genuine (non-demo) use away from the user's own
  machine. Not started. Distinct from the Vercel demo deployment below, which
  deliberately has no backend at all.

## Done, no longer tracked here

- ~~Vercel deployment of the frontend~~ — done, but not the originally-envisioned
  real-backend deployment: a frontend-only, mocked-data portfolio demo
  (`resi-the-builder.vercel.app`, see `ARCHITECTURE.md`). A real-backend-connected
  deployment is still what the Cloudflare Tunnel item above would enable, if picked
  back up.

## Known soft spots (not bugs, flagged for whoever touches that area next)

- **Frontend types are hand-mirrored from `backend/app/models.py`, not
  shared/generated** (`frontend/app/types.ts`). Every backend schema change (and
  there have been many — meta/entry fields, skill items, links, summary pool, cover
  letter salutation/sign-off, etc.) has required a matching manual edit here, and has
  been kept in sync successfully every time, but there's no structural guarantee
  against drift (e.g. via OpenAPI codegen). Flagged from early in the build, never
  caused an actual bug — noted here only as forward-looking risk, not an active
  problem.
