# Backend (FastAPI)

Python 3.13, FastAPI, Pydantic v2, Anthropic SDK, python-docx. Run commands from `backend/`.

- Test: `.venv/bin/pytest`. `pytest.ini` excludes `live` (real API calls) and `slow`
  (LibreOffice PDF) tests by default. Run them with `-m live` / `-m slow` only when asked.
- Tests must not reach the real Anthropic client. `conftest.py` fails any unmarked test
  that tries to. Use the `mock_llm` fixture for canned responses.
- Run: `.venv/bin/uvicorn app.main:app --reload --port 8000`. Swagger is at `/docs`.
- Secrets: `.env` (copy from `.env.example`) holds `ANTHROPIC_API_KEY`. Never commit it.

## Conventions

- `app/routes/` stays thin: parse, call a service, map errors to HTTP status codes.
- All Anthropic calls live in `app/services/llm.py`. Prompt caching depends on the shared
  system-prompt preamble staying identical across generate calls.
- `app/services/render.py` does templating only, with no LLM calls. PDF export shells out
  to LibreOffice at a hardcoded macOS Homebrew path.
- `app/services/usage_guard.py`: daily call cap and input-length guard.
- No database. Data is JSON on disk under `app/data/`.

## Pins (don't change without asking)

- Python 3.13, not 3.14 or 3.12. If the venv breaks (e.g. a stray `python3.14` symlink in
  `.venv/bin`), rebuild it: `rm -rf .venv && python3.13 -m venv .venv`.
- `anthropic==1.5.0`. The spec's 0.39.0 crashes with modern `httpx`.
