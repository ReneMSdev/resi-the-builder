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
    "Software engineer who owns backend systems end-to-end, from API design and testing through CI, using Python, Node.js and Docker, with cloud experience on AWS and GCP.",
  b1: "Architected LinkLeaf's FastAPI/PostgreSQL backend as a modular monolith, verifying Firebase tokens and serving private files from GCS through short-lived signed URLs.",
  b2: "Built a GitHub Actions CI pipeline that spins up PostgreSQL 16, applies Alembic migrations and runs the full test suite on every pull request.",
  b3: "Grew the API test suite to 133 async pytest tests across 8 modules, run against a real PostgreSQL database with a 50% coverage floor enforced in CI.",
  b4: "Built a TypeScript/Express REST API on PostgreSQL that pairs Google Geocoding with the National Weather Service API, storing each city's lookup so repeat requests skip two external calls.",
  b5: "Automated CI/CD with GitHub Actions: every push and pull request must pass a TypeScript build, and a Render deploy hook fires only from main.",
}

export const demoCoverLetterRefinements: Record<string, string> = {
  p1: "I'm excited to apply for the Software Engineer role at Justworks, a team that clearly values both the product and the people building it, and where I can own meaningful projects end-to-end.",
  p2: "At Salo Labs, I co-founded LinkLeaf and built its FastAPI and PostgreSQL backend, a CI pipeline that runs migrations and the full test suite on every pull request, and 133 API tests against a real database. I'd be thrilled to bring that same hands-on ownership to Justworks' engineering team.",
}
