from fastapi import APIRouter, HTTPException

from app.models import ReviseRequest, ReviseResponse
from app.services.llm import revise_resume, revise_cover_letter, revise_profile

router = APIRouter()


@router.post("/revise", response_model=ReviseResponse)
def revise(req: ReviseRequest):
    provided = [x for x in (req.resume, req.cover_letter, req.profile) if x is not None]
    if len(provided) != 1:
        raise HTTPException(
            status_code=400,
            detail="Request must include exactly one of 'resume', 'cover_letter', or 'profile'.",
        )

    try:
        if req.profile is not None:
            # job_description is never forwarded here, even if a caller sends one —
            # profile editing isn't job-tailoring, and revise_profile doesn't accept
            # the parameter at all, so there's no path for it to leak into the prompt.
            result = revise_profile(req.profile.model_dump(), req.selected_ids, req.instruction)
        elif req.cover_letter is not None:
            result = revise_cover_letter(
                req.cover_letter.model_dump(), req.selected_ids, req.instruction, req.job_description
            )
        else:
            result = revise_resume(
                req.resume.model_dump(), req.selected_ids, req.instruction, req.job_description
            )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))

    return result
