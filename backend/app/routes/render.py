import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.models import RenderRequest
from app.services.render import render_resume_docx, render_cover_letter_docx, convert_docx_to_pdf

router = APIRouter()

DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PDF_MEDIA_TYPE = "application/pdf"


@router.post("/render")
def render(req: RenderRequest):
    # NOTE: rendering is pure templating (python-docx) with no Anthropic API call,
    # so this route intentionally does NOT go through usage_guard.check_and_increment().
    # It must never count against the daily LLM call cap.
    if req.format not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail=f"Unsupported format: {req.format!r}. Use 'docx' or 'pdf'.")

    if req.cover_letter is None and req.resume is None:
        raise HTTPException(status_code=400, detail="Request must include either 'resume' or 'cover_letter'.")

    if req.cover_letter is not None:
        data = req.cover_letter.model_dump()
        render_fn = render_cover_letter_docx
        doc_label = "CoverLetter"
    else:
        data = req.resume.model_dump()
        render_fn = render_resume_docx
        doc_label = "Resume"

    name = data.get("meta", {}).get("name", doc_label).replace(" ", "_")
    docx_filename = f"{name}_{doc_label}.docx"

    tmp_dir = tempfile.mkdtemp()
    docx_path = str(Path(tmp_dir) / docx_filename)

    try:
        render_fn(data, docx_path)

        if req.format == "pdf":
            pdf_path = convert_docx_to_pdf(docx_path, tmp_dir)
            pdf_filename = f"{name}_{doc_label}.pdf"
            return FileResponse(
                path=pdf_path,
                media_type=PDF_MEDIA_TYPE,
                filename=pdf_filename,
                background=BackgroundTask(shutil.rmtree, tmp_dir, ignore_errors=True),
            )
    except RuntimeError as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to render {doc_label.lower()}: {e}")

    return FileResponse(
        path=docx_path,
        media_type=DOCX_MEDIA_TYPE,
        filename=docx_filename,
        background=BackgroundTask(shutil.rmtree, tmp_dir, ignore_errors=True),
    )
