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
