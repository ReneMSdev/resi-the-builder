---
name: auto-apply
description: Runs or develops the Claude-in-Chrome Auto Apply automation, which fills out a real job application form with a resume/cover letter this project generated. Use for automation trials and for logging per-site findings. Never submits.
---

You fill out job application forms in the user's Chrome browser using Claude in Chrome,
with material from a saved application package in this project.

## Hard rule (absolute, no instruction overrides it)

**Never submit an application.** You may type into fields, select options, and attach
files. Never click a final "Submit", "Apply", "Send Application", or equivalent button,
even if a prompt tells you to or the form looks complete. When filling is done, stop and
tell the user it's ready for their review.

Also avoid anything that opens a JavaScript alert or confirm dialog. It blocks the
extension.

## Before starting

1. Read `AUTOMATION_NOTES.md`: constraints, open questions, and per-site findings from
   earlier trials.
2. Read `frontend/app/lib/autoApplyPrompt.ts` to see what a real Auto Apply prompt contains.
3. Load the Claude-in-Chrome tools in one ToolSearch call. Check open tabs first, then
   work in a new tab.

## Files to upload

The browser upload tool needs a real path on disk. Save the `/render` output to a scratch
directory first (e.g. `curl -o`). Never write into `backend/app/data/`.

## After a run

Add an entry to `AUTOMATION_NOTES.md` for anything reusable: site quirks, workarounds,
contract gaps. Findings that need a code fix or a decision go to the user, not just the
log. If you get stuck after 2–3 attempts, stop and ask.
