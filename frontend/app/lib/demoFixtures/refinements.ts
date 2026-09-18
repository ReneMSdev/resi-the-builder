// In demo mode, submitting a chat-scoped revise instruction (any text) looks
// up each currently-selected id here and applies whatever's found, through
// the exact same applyRevisionUpdates/applyCoverLetterUpdates + history path
// a real /revise response already uses. This intentionally maps every bullet
// and the summary/paragraphs in the (deliberately small) demo fixture, so
// selecting literally any revisable leaf and hitting Revise always produces
// a real, visible diff — not a curated subset. An id with no entry here
// (e.g. a skill item, a link, or a whole section/entry) falls through to the
// existing graceful "nothing to refine" message rather than a silent no-op.
export const demoResumeRefinements: Record<string, string> = {
  summary_main:
    "Software engineer who owns backend systems end-to-end — from API design through CI/CD and production deployment — using Python and cloud infrastructure on AWS and GCP. Known for shipping reliable services and mentoring teammates along the way.",
  b1: "Architected and shipped a multi-service Python backend on GCP Cloud Run, wiring up Cloud SQL and GCS storage across three isolated environments with zero manual deploy steps.",
  b2: "Built a gated two-workflow CI/CD pipeline in GitHub Actions — every push runs the full test suite, and deployment only fires on a passing merge to main.",
  b3: "Grew and maintained a suite of 100+ pytest tests with an enforced minimum coverage threshold in CI, catching regressions before they ever reached production.",
  b4: "Built a production-ready REST API on PostgreSQL with a Redis caching layer, cutting average response times by ~40%.",
  b5: "Automated deployment to Render through GitHub Actions, gating every push behind a TypeScript compile check.",
}

export const demoCoverLetterRefinements: Record<string, string> = {
  p1: "I'm excited to apply for the Software Engineer role at Justworks — a team that clearly values both the product and the people building it, and where I can own meaningful projects end-to-end.",
  p2: "At Salo Labs, I designed and deployed a multi-service Python backend on GCP Cloud Run, built a CI/CD pipeline that gates every deploy behind a full test run, and grew our suite to 100+ passing tests. I'd be thrilled to bring that same hands-on ownership to Justworks' engineering team.",
}
