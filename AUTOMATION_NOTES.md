# Claude-in-Chrome Job Application Automation — Findings Log

Living log of what's discovered while using Claude-in-Chrome to automate the job-application
step (fill out an external job site's application form using a resume/cover letter generated
by this project). Not a status report — see [`STATUS.md`](STATUS.md) and
[`TODO.md`](TODO.md) for that. Append an entry here whenever an automation session hits
something worth remembering for next time: a site-specific quirk, a form pattern that needed
a workaround, or a limitation of the current backend/frontend contract that made automation
harder than it should have been.

## Hard constraints (do not relax without the user revisiting this)

- **Never submit an application automatically.** Automation may fill in text fields and
  attach files only. Clicking final "Submit"/"Apply" is always a human action.
- Findings that require an actual code fix or a design decision should also be relayed live
  to the manager session (cross-session message), not just logged here — this file is for
  durable, reusable knowledge, not a substitute for getting something fixed.

## Status

Not yet started — no automation session has been run against a real job posting yet. This
file was set up ahead of the first trial so findings have somewhere to land immediately
instead of being lost to a single chat transcript.

## Known open question (not yet resolved by a real trial)

- **File handoff**: `/render` returns a file over HTTP; Claude-in-Chrome's file-upload tool
  needs a real path on disk. Plan is to save the `/render` response to a scratch directory
  (e.g. via `curl -o`) before attaching it in the browser — untested against a real ATS form
  so far.

## Per-site findings

(none yet)
