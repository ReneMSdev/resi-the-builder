import anthropic
from fastapi import APIRouter, HTTPException

from app.models import ReviseRequest, ReviseResponse
from app.services.llm import revise_resume, revise_cover_letter, revise_profile
from app.services.revise_scope import (
    cover_letter_removable_ids,
    filter_removals,
    resume_removable_ids,
)
from app.routes.llm_errors import anthropic_http_exception

router = APIRouter()


@router.post("/revise", response_model=ReviseResponse)
def revise(req: ReviseRequest):
    provided = [x for x in (req.resume, req.cover_letter, req.profile) if x is not None]
    if len(provided) != 1:
        raise HTTPException(
            status_code=400,
            detail="Request must include exactly one of 'resume', 'cover_letter', or 'profile'.",
        )

    # An empty selection means "the whole document" for a resume or cover letter. The
    # master profile isn't eligible for whole-document revision.
    if req.profile is not None and not req.selected_ids:
        raise HTTPException(status_code=400, detail="Select part of the profile to revise.")

    try:
        if req.profile is not None:
            # job_description is never forwarded here, even if a caller sends one —
            # profile editing isn't job-tailoring, and revise_profile doesn't accept
            # the parameter at all, so there's no path for it to leak into the prompt.
            result = revise_profile(req.profile.model_dump(), req.selected_ids, req.instruction)
            result["removals"] = []  # profile revisions never remove anything
        elif req.cover_letter is not None:
            cover_letter = req.cover_letter.model_dump()
            result = revise_cover_letter(
                cover_letter, req.selected_ids, req.instruction, req.job_description
            )
            result = filter_removals(
                result,
                cover_letter_removable_ids(cover_letter, req.selected_ids),
                lambda ids: cover_letter_removable_ids(cover_letter, ids),
            )
        else:
            resume = req.resume.model_dump()
            result = revise_resume(resume, req.selected_ids, req.instruction, req.job_description)
            result = filter_removals(
                result,
                resume_removable_ids(resume, req.selected_ids),
                lambda ids: resume_removable_ids(resume, ids),
            )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except anthropic.APIError as e:
        raise anthropic_http_exception(e)

    return result
