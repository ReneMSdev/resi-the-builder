# Resume Builder — Project Context & Build Instructions

Give this file to Claude Code and have it build out the `/backend` folder described below.

## What this project is

A personal-use tool to speed up job applications. Input: a job description (pasted or
agent-fetched from the web). Output: a tailored resume/cover letter, editable via a
selection + chat-instruction workflow, downloadable as docx/pdf.

Not RAG — the candidate's own profile data is small (one person's work history), so the
full profile is passed to the LLM in every request rather than using embeddings/retrieval.

## Architecture decisions (already made — follow these)

- **Backend**: FastAPI, runs **locally only** (not deployed to cloud hosting). No database.
  Persists data as a JSON file on disk (`app/data/profile.json`).
- **Frontend**: Next.js, deployed to Vercel (free tier). Talks to the local backend via a
  Cloudflare Tunnel (stable hostname) when in use. Frontend holds no persistent data —
  everything lives in React state until download.
- **No conversation history / no sessions.** Every `/generate` and `/revise` call is
  stateless — the full resume JSON travels with each request from the frontend.
- **Two separate JSON shapes:**
  - `profile.json` — the master/full universe of the candidate's experience (every job,
    project, bullet, skill, cert). Lives only on the backend.
  - "Resume JSON" — a generated, tailored SUBSET + rewrite of the profile, produced fresh
    by `/generate` for each job description. This is what the frontend renders and edits.
- **Stable IDs on every editable unit** (bullet, entry, section, summary) so the frontend
  can let the user select specific pieces and send only those + an instruction to
  `/revise`, which returns just the replacement text for those IDs (no full-document
  rewrite, no drift elsewhere).
- **Tags on bullets** (in profile.json only) are optional metadata to help `/generate`
  prioritize relevant content per job description — a lightweight filter, not a
  replacement for the LLM's own judgment. Not required for the architecture to function,
  just a future optimization lever once the profile grows large.
- **Monorepo**: GitHub repo has top-level `/backend` and `/frontend` folders. Repo is
  private. `profile.json` IS committed to git (private repo, versioning it is useful).
- **LLM**: Anthropic API, `claude-sonnet-4-6` model, called server-side from FastAPI only
  (never from the frontend directly — API key stays on the backend).

## Resume JSON schema (what `/generate` must return)

```json
{
  "type": "resume",
  "meta": {
    "name": "Rene Maxey-Salomone",
    "email": "rene.salomone@gmail.com",
    "phone": "+1 (512) 884-3571",
    "links": [{ "label": "GitHub", "url": "github.com/ReneMSdev" }]
  },
  "summary": { "id": "summary", "text": "..." },
  "sections": [
    {
      "id": "sec_experience",
      "title": "Experience",
      "type": "experience",
      "entries": [
        {
          "id": "entry_salolabs",
          "title": "Software & DevOps Engineer",
          "organization": "Salo Labs LLC",
          "location": "Austin, TX",
          "dates": "January 2026 - Present",
          "bullets": [
            { "id": "b_salo_1", "text": "...", "tags": ["gcp", "backend"] }
          ]
        }
      ],
      "groups": []
    },
    {
      "id": "sec_skills",
      "title": "Skills",
      "type": "skills",
      "entries": [],
      "groups": [
        { "id": "skill_devops", "label": "DevOps / Cloud", "items": ["GCP", "AWS", "Docker"] }
      ]
    }
  ]
}
```

Section `type` values: `experience`, `projects`, `education`, `certifications`, `skills`.
Skills sections use `groups` (label + items list); all other section types use `entries`
(title/org/location/dates/bullets). Omit sections with no relevant content rather than
returning them empty.

## Cover letter variant (simpler, same selection model)

```json
{
  "type": "cover_letter",
  "meta": { "name": "...", "email": "...", "phone": "...", "date": "...", "company": "...", "role": "..." },
  "paragraphs": [
    { "id": "p1", "text": "..." },
    { "id": "p2", "text": "..." }
  ]
}
```

## Backend folder structure to create

```
backend/
  app/
    __init__.py
    main.py
    models.py
    routes/
      __init__.py
      profile.py
      generate.py
    services/
      __init__.py
      llm.py
    data/
      profile.json
  requirements.txt
  .env.example
  .gitignore
```

## File contents

### requirements.txt
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
anthropic==0.39.0
pydantic==2.9.2
python-dotenv==1.0.1
```

### .env.example
```
ANTHROPIC_API_KEY=your_key_here
```

### backend/.gitignore (or add to root .gitignore if repo already has one)
```
__pycache__/
**/__pycache__/
.venv/
*.egg-info/
.pytest_cache/
.env
```

### app/models.py
```python
from pydantic import BaseModel
from typing import Optional


class Link(BaseModel):
    label: str
    url: str


class Meta(BaseModel):
    name: str
    email: str
    phone: str
    links: list[Link] = []


class Bullet(BaseModel):
    id: str
    text: str
    tags: list[str] = []


class Entry(BaseModel):
    id: str
    title: str
    organization: str
    location: str = ""
    dates: str = ""
    bullets: list[Bullet] = []


class SkillGroup(BaseModel):
    id: str
    label: str
    items: list[str]


class Section(BaseModel):
    id: str
    title: str
    type: str  # experience | projects | education | certifications | skills
    entries: list[Entry] = []
    groups: list[SkillGroup] = []  # only used when type == "skills"


class Summary(BaseModel):
    id: str = "summary"
    text: str = ""


class Resume(BaseModel):
    type: str = "resume"
    meta: Meta
    summary: Summary
    sections: list[Section]


class Profile(BaseModel):
    """Master data — the full universe of the candidate's experience, not tailored to any JD."""
    meta: Meta
    summary_pool: list[str] = []
    sections: list[Section]


class GenerateRequest(BaseModel):
    job_description: str
    company_context: Optional[str] = None


class GenerateResponse(BaseModel):
    resume: Resume


class ReviseRequest(BaseModel):
    selected_ids: list[str]
    instruction: str
    resume: Resume


class ReviseUpdate(BaseModel):
    id: str
    text: str


class ReviseResponse(BaseModel):
    updates: list[ReviseUpdate]
```

Note: `ReviseRequest`/`ReviseResponse` are included for the NEXT step (not built yet in
this pass) — `/revise` takes selected IDs + an instruction + the current full resume JSON,
and returns replacement text for just those IDs. Build `/generate` and `/profile` first;
`/revise` follows the same pattern once those are working.

### app/routes/profile.py
```python
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from app.models import Profile

router = APIRouter()

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "profile.json"


@router.get("/profile", response_model=Profile)
def get_profile():
    if not DATA_PATH.exists():
        raise HTTPException(status_code=404, detail="profile.json not found")
    with open(DATA_PATH, "r") as f:
        data = json.load(f)
    return data


@router.put("/profile", response_model=Profile)
def update_profile(profile: Profile):
    with open(DATA_PATH, "w") as f:
        json.dump(profile.model_dump(), f, indent=2)
    return profile
```

### app/services/llm.py
```python
import os
import json
from anthropic import Anthropic

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MODEL = "claude-sonnet-4-6"

GENERATE_SYSTEM_PROMPT = """You are a resume-tailoring assistant. You will be given:
1. A candidate's full profile data (all their jobs, projects, education, certifications, skills)
2. A job description they are applying to
3. Optional extra context about the company/role

Your job: select and rewrite the most relevant content from the profile to produce a
tailored resume for this specific job. Prioritize bullets whose tags or content match
the job description's requirements. Rewrite bullet text to naturally incorporate keywords
from the job description where truthful and accurate — do not fabricate skills, numbers,
or experience not present in the profile.

Return ONLY valid JSON matching this exact structure (no markdown fences, no preamble):

{
  "type": "resume",
  "meta": { "name": "...", "email": "...", "phone": "...", "links": [...] },
  "summary": { "id": "summary", "text": "..." },
  "sections": [
    {
      "id": "sec_...",
      "title": "...",
      "type": "experience|projects|education|certifications|skills",
      "entries": [
        {
          "id": "entry_...",
          "title": "...",
          "organization": "...",
          "location": "...",
          "dates": "...",
          "bullets": [ { "id": "b_...", "text": "...", "tags": [...] } ]
        }
      ],
      "groups": [ { "id": "skill_...", "label": "...", "items": [...] } ]
    }
  ]
}

Generate new unique ids for the summary and any reworded bullets (prefix with a short
random suffix to avoid collisions, e.g. "b_salo_1_r2"). Keep ids for entries/sections
that map directly to profile entries so downstream tooling can trace them. Include a
"groups" array only for sections of type "skills"; use an empty "entries" array for
skills sections. Omit sections that have no relevant content for this job rather than
including empty ones.
"""


def generate_resume(profile: dict, job_description: str, company_context: str | None = None) -> dict:
    user_content = f"""PROFILE DATA:
{json.dumps(profile, indent=2)}

JOB DESCRIPTION:
{job_description}
"""
    if company_context:
        user_content += f"\nADDITIONAL COMPANY/ROLE CONTEXT:\n{company_context}\n"

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=GENERATE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    text = "".join(block.text for block in response.content if block.type == "text").strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Model did not return valid JSON: {e}\nRaw output:\n{text[:500]}")
```

### app/routes/generate.py
```python
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from app.models import GenerateRequest, GenerateResponse
from app.services.llm import generate_resume

router = APIRouter()

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "profile.json"


@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    if not DATA_PATH.exists():
        raise HTTPException(status_code=404, detail="profile.json not found")

    with open(DATA_PATH, "r") as f:
        profile = json.load(f)

    try:
        resume_data = generate_resume(profile, req.job_description, req.company_context)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"resume": resume_data}
```

### app/main.py
```python
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import profile, generate

app = FastAPI(title="Resume Builder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to actual frontend URL(s) once deployed
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(generate.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

### app/data/profile.json

Seed this with the candidate's real resume data below (already structured to match the
schema — use as-is):

```json
{
  "meta": {
    "name": "Rene Maxey-Salomone",
    "email": "rene.salomone@gmail.com",
    "phone": "+1 (512) 884-3571",
    "links": [
      { "label": "GitHub", "url": "github.com/ReneMSdev" }
    ]
  },
  "summary_pool": [
    "Software engineer with hands-on DevOps/cloud experience building and deploying production FastAPI services on GCP, backed by 8+ years of field telecom work.",
    "Solo technical founder and backend engineer specializing in FastAPI, GCP Cloud Run, and CI/CD pipelines, transitioning from telecom field work into cloud/software engineering."
  ],
  "sections": [
    {
      "id": "sec_experience",
      "title": "Experience",
      "type": "experience",
      "entries": [
        {
          "id": "entry_salolabs",
          "title": "Software & DevOps Engineer",
          "organization": "Salo Labs LLC",
          "location": "Austin, TX",
          "dates": "January 2026 - Present",
          "bullets": [
            {
              "id": "b_salo_1",
              "text": "Architected and built LinkLeaf, a QR code-based digital identity platform with a FastAPI backend, Flutter mobile frontend, and fully containerized GCP infrastructure.",
              "tags": ["backend", "mobile", "architecture", "gcp", "fastapi"]
            },
            {
              "id": "b_salo_2",
              "text": "Designed and deployed a multi-service FastAPI backend to GCP Cloud Run, integrating Cloud SQL (PostgreSQL), dual GCS buckets with signed URL access controls, and Firebase Authentication across isolated dev/staging/production environments.",
              "tags": ["gcp", "backend", "cloud-run", "postgresql", "firebase"]
            },
            {
              "id": "b_salo_3",
              "text": "Built a gated two-workflow GitHub Actions CI/CD pipeline: automated testing on push/PR with a live PostgreSQL service container, deployment to Cloud Run triggered only on passing merge to main.",
              "tags": ["ci-cd", "github-actions", "testing"]
            },
            {
              "id": "b_salo_4",
              "text": "Containerized the application using a multi-stage Dockerfile with an entrypoint script handling database migrations before server startup.",
              "tags": ["docker", "devops"]
            },
            {
              "id": "b_salo_5",
              "text": "Maintained 100+ passing pytest tests across 7 modules in a modular monolith architecture with GCS and Firebase fully mocked for testing; CI enforces minimum coverage threshold on every push.",
              "tags": ["testing", "pytest", "ci-cd"]
            }
          ]
        },
        {
          "id": "entry_sandcastle",
          "title": "Fiber Optic Technician",
          "organization": "SandCastle (contracting for Google Fiber)",
          "location": "Austin, TX",
          "dates": "March 2026 - Present",
          "bullets": [
            {
              "id": "b_sc_1",
              "text": "Contributed to Google Fiber's infrastructure deployment and quality assurance for network operations.",
              "tags": ["field-work", "networking"]
            }
          ]
        },
        {
          "id": "entry_freelance",
          "title": "Freelance Full-Stack Engineer",
          "organization": "Self Employed",
          "location": "Remote",
          "dates": "October 2024 - January 2026",
          "bullets": [
            {
              "id": "b_fl_1",
              "text": "Integrated an AWS RDS PostgreSQL database for a startup's (Ecobridge) Shopify plugin, modeling merchant accounts, configuration settings, and cache data, improving sync reliability and reducing Shopify API calls by ~30%.",
              "tags": ["aws", "postgresql", "backend"]
            },
            {
              "id": "b_fl_2",
              "text": "Implemented a reliable Shopify OAuth flow in Node.js (Express) and TypeScript to securely handle app installation, token exchange, and merchant authentication, reducing auth-related errors by ~10%.",
              "tags": ["nodejs", "typescript", "oauth"]
            },
            {
              "id": "b_fl_3",
              "text": "Leveraged modern AI coding tools (Cursor, GPT) to accelerate prototyping and documentation, reducing development time by ~25%.",
              "tags": ["ai-tools", "productivity"]
            }
          ]
        }
      ]
    },
    {
      "id": "sec_projects",
      "title": "Projects",
      "type": "projects",
      "entries": [
        {
          "id": "entry_weather",
          "title": "Weather Alerts API Backend (Node.js, Express, TypeScript)",
          "organization": "Personal Project",
          "location": "github.com/ReneMSdev/weather-alerts-backend",
          "dates": "",
          "bullets": [
            {
              "id": "b_wa_1",
              "text": "Built a production-ready REST API with PostgreSQL, Redis caching, and node cron background jobs for automated weather data sync, achieving ~40% faster response times.",
              "tags": ["nodejs", "postgresql", "redis"]
            },
            {
              "id": "b_wa_2",
              "text": "Deployed to Render via GitHub Actions: TypeScript compile gate on push/PR, automated deploy hook triggered on merge to main.",
              "tags": ["ci-cd", "deployment"]
            },
            {
              "id": "b_wa_3",
              "text": "Provided REST API endpoints consumed by a cross-platform iOS/Android app built with React Native (Expo).",
              "tags": ["react-native", "mobile"]
            }
          ]
        }
      ]
    },
    {
      "id": "sec_education",
      "title": "Education",
      "type": "education",
      "entries": [
        {
          "id": "entry_wgu",
          "title": "Bachelor of Science in Computer Science",
          "organization": "Western Governors University",
          "location": "Salt Lake City, UT",
          "dates": "2024",
          "bullets": []
        }
      ]
    },
    {
      "id": "sec_certifications",
      "title": "Certifications",
      "type": "certifications",
      "entries": [
        {
          "id": "cert_aws_ccp",
          "title": "AWS Certified Cloud Practitioner",
          "organization": "Amazon Web Services",
          "location": "",
          "dates": "2025",
          "bullets": []
        },
        {
          "id": "cert_linux",
          "title": "Linux Essentials",
          "organization": "Linux Professional Institute",
          "location": "",
          "dates": "2024",
          "bullets": []
        },
        {
          "id": "cert_itil",
          "title": "ITIL 4 - Foundation Certificate in IT Service Management",
          "organization": "PeopleCert (AXELOS)",
          "location": "",
          "dates": "2024",
          "bullets": []
        },
        {
          "id": "cert_psm",
          "title": "Professional Scrum Master I (PSM I)",
          "organization": "Scrum.org",
          "location": "",
          "dates": "2023",
          "bullets": []
        }
      ]
    },
    {
      "id": "sec_skills",
      "title": "Skills",
      "type": "skills",
      "entries": [],
      "groups": [
        {
          "id": "skill_devops",
          "label": "DevOps / Cloud",
          "items": ["GCP (Cloud Run, Cloud SQL, GCS)", "AWS", "Docker", "GitHub Actions CI/CD", "Firebase", "Linux"]
        },
        {
          "id": "skill_backend",
          "label": "Backend",
          "items": ["FastAPI (Python)", "Node.js", "Express", "TypeScript", "JavaScript", "REST APIs"]
        },
        {
          "id": "skill_databases",
          "label": "Databases",
          "items": ["PostgreSQL", "Redis", "Drizzle ORM", "SQLAlchemy", "Schema Design"]
        },
        {
          "id": "skill_testing",
          "label": "Testing",
          "items": ["Pytest", "unittest.mock", "API Testing"]
        }
      ]
    }
  ]
}
```

## What to do

1. Create the folder structure and files exactly as specified above (need `__init__.py`
   in `app/`, `app/routes/`, and `app/services/` — empty files are fine).
2. Set up a Python virtual environment and install `requirements.txt`.
3. Copy `.env.example` to `.env` and prompt me to paste in my real `ANTHROPIC_API_KEY`
   (do not commit `.env` — it's gitignored).
4. Run the server with `uvicorn app.main:app --reload` and confirm `/health` and `GET
   /profile` work.
5. Test `POST /generate` via `/docs` (Swagger UI) with a real job description and show me
   the output — verify it's valid JSON matching the schema and the content is sensibly
   tailored.

## Not yet built (next steps after this works) — don't build these yet unless asked

- `/revise` endpoint (selected IDs + instruction → replacement text for just those IDs)
- `/render` endpoint (resume JSON → docx/pdf via python-docx)
- The Next.js frontend (two-pane layout: selectable resume preview + chat input scoped to
  selection)
- Cloudflare Tunnel setup for exposing the local backend to the Vercel-hosted frontend
