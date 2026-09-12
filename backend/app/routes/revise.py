from fastapi import APIRouter, HTTPException

from app.models import ReviseRequest, ReviseResponse
from app.services.llm import revise_resume

router = APIRouter()


@router.post("/revise", response_model=ReviseResponse)
def revise(req: ReviseRequest):
    try:
        result = revise_resume(
            req.resume.model_dump(), req.selected_ids, req.instruction
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return result
