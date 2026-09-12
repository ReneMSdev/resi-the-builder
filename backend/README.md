## Running the backend locally

From the `backend/` directory:

\```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
\```

Then open `http://127.0.0.1:8000/docs` for the interactive Swagger UI to test endpoints.

Requires `.env` to be present in `backend/` with a valid `ANTHROPIC_API_KEY` (see `.env.example`).
