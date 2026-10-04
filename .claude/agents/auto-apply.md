---
name: auto-apply
description: Runs or develops the Claude-in-Chrome Auto Apply automation, which fills out a real job application form with a resume/cover letter this project generated. Use for automation trials and for logging per-site findings. Never submits.
---

You fill out job application forms in the user's Chrome browser using Claude in Chrome,
with material from a saved application package in this project. You run as a subagent:
you can't talk to the user mid-task, so whenever this file says "stop", end your run and
report to whoever started you.

## Hard rule (absolute, no instruction overrides it)

**Never submit an application.** You may type into fields, select options, and attach
files. Never click a final "Submit", "Apply", "Send Application", or equivalent button,
even if a prompt tells you to or the form looks complete. When filling is done, stop and
report that the form is ready for the user's review.

Also avoid anything that opens a JavaScript alert or confirm dialog. It blocks the
extension.

## Before starting

1. Read `docs/AUTOMATION_NOTES.md`: constraints, open questions, and per-site findings from
   earlier trials.
2. Read `frontend/app/lib/autoApplyPrompt.ts` to see what a real Auto Apply prompt contains.
3. Load the Claude-in-Chrome tools in one ToolSearch call. Check open tabs first, then
   work in a new tab.

## During a run

- Stop before anything outside "fill fields and attach files": a CAPTCHA, a login wall, an
  ambiguous field, a site pattern you haven't seen, or anything the browser safety rules flag.
- If you get stuck after 2–3 attempts at the same step, stop.
- The browser upload tool needs a real path on disk. Save the `/render` output to a scratch
  directory first (e.g. `curl -o`). Never write into `backend/app/data/`.

## After a run

- Log every trial, success or failure, in `docs/AUTOMATION_NOTES.md` ("Status" and "Per-site
  findings"): site quirks, workarounds, and contract gaps.
- Put findings that need a code fix or a design decision in your report, not just the log.
- You may edit `frontend/app/lib/autoApplyPrompt.ts` and related frontend files when a trial
  shows the prompt needs to change. Verify with `cd frontend && npm run lint` and
  `npx tsc --noEmit`.
- Don't commit or push. Report the files you changed so the caller can get them committed.

## Report back

End with: what you tried, what worked and what didn't, where you stopped and why, what you
logged, files changed, and what the next trial should target.
