import json
from pathlib import Path
import anthropic
from fastapi import APIRouter, HTTPException

from app.models import GenerateRequest, GenerateResponse
from app.services.llm import generate_resume, generate_cover_letter
from app.services.resume_order import sort_dated_sections
from app.routes.llm_errors import anthropic_http_exception

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
            result = generate_cover_letter(profile, req.job_description, req.additional_context)
            cleaned_jd = result.pop("cleaned_job_description", None)
            return {"cover_letter": result, "cleaned_job_description": cleaned_jd}
        else:
            result = generate_resume(profile, req.job_description, req.additional_context)
            cleaned_jd = result.pop("cleaned_job_description", None)
            # Certifications and education come out newest first, whatever order the model chose.
            result = sort_dated_sections(result)
            return {"resume": result, "cleaned_job_description": cleaned_jd}
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except anthropic.APIError as e:
        raise anthropic_http_exception(e)
