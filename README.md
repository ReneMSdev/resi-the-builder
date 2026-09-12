# Resume Builder

Personal tool to speed up job applications. Paste a job description, get a Claude-tailored
resume or cover letter generated from a master profile, edit pieces via chat-scoped
revision, then download a formatted `.docx`/`.pdf`.

Monorepo: `backend/` (FastAPI + Anthropic) and `frontend/` (Next.js). See
[`STATUS.md`](STATUS.md) for current project status, and each subproject's own
`STATUS_BACKEND.md` / `STATUS_FRONTEND.md` for implementation detail.

## Prerequisites

- Python 3.13 (not 3.14 or 3.12 — see `backend/STATUS_BACKEND.md` for why)
- Node.js (for the frontend)
- [LibreOffice](https://www.libreoffice.org/) installed locally (`brew install --cask libreoffice`
  on macOS) — required for PDF export via the backend's `/render` endpoint
- An Anthropic API key

Both servers run locally. Start the backend first, then the frontend.

## 1. Backend

```bash
cd backend
python3.13 -m venv .venv        # first time only
source .venv/bin/activate
pip install -r requirements.txt # first time only
```

Copy `.env.example` to `.env` and fill in a real key:

```bash
cp .env.example .env            # then edit .env and set ANTHROPIC_API_KEY
```

Run the server:

```bash
uvicorn app.main:app --reload --port 8000
```

Open `http://127.0.0.1:8000/docs` for the interactive Swagger UI to test endpoints
directly. See `backend/README.md` for more.

## 2. Frontend

In a separate terminal:

```bash
cd frontend
npm install                     # first time only
```

Create `frontend/.env.local` pointing at the backend:

```bash
echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000" > .env.local
```

Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser. See `frontend/README.md` for more.

## Notes

- Both servers must be running for the app to work — the frontend calls the backend
  directly over HTTP, no proxy in between.
- CORS on the backend is wide open (`allow_origins=["*"]`) for local dev.
- The backend enforces a daily call cap and input-length limits as guardrails against
  runaway API spend — see `backend/STATUS_BACKEND.md` for details. Set a spend limit in
  the Anthropic console as the real backstop.
