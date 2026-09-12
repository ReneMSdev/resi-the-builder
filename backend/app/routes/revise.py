from fastapi import APIRouter, HTTPException

from app.models import ReviseRequest, ReviseResponse
from app.services.llm import revise_resume, revise_cover_letter

router = APIRouter()


@router.post("/revise", response_model=ReviseResponse)
def revise(req: ReviseRequest):
    if req.cover_letter is None and req.resume is None:
        raise HTTPException(status_code=400, detail="Request must include either 'resume' or 'cover_letter'.")

    try:
        if req.cover_letter is not None:
            result = revise_cover_letter(
                req.cover_letter.model_dump(), req.selected_ids, req.instruction
            )
        else:
            result = revise_resume(
                req.resume.model_dump(), req.selected_ids, req.instruction
            )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))

    return result
