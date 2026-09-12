import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from app.models import GenerateRequest, GenerateResponse
from app.services.llm import generate_resume, generate_cover_letter

router = APIRouter()

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "profile.json"


@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    if not DATA_PATH.exists():
        raise HTTPException(status_code=404, detail="profile.json not found")

    if req.type not in ("resume", "cover_letter"):
        raise HTTPException(status_code=400, detail=f"Unknown type: {req.type}")

    with open(DATA_PATH, "r") as f:
        profile = json.load(f)

    try:
        if req.type == "cover_letter":
            result = generate_cover_letter(profile, req.job_description, req.company_context)
            return {"cover_letter": result}
        else:
            result = generate_resume(profile, req.job_description, req.company_context)
            return {"resume": result}
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
