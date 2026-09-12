import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.models import RenderRequest
from app.services.render import render_resume_docx, convert_docx_to_pdf

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

    resume_dict = req.resume.model_dump()
    name = resume_dict.get("meta", {}).get("name", "Resume").replace(" ", "_")
    docx_filename = f"{name}_Resume.docx"

    tmp_dir = tempfile.mkdtemp()
    docx_path = str(Path(tmp_dir) / docx_filename)

    try:
        render_resume_docx(resume_dict, docx_path)

        if req.format == "pdf":
            pdf_path = convert_docx_to_pdf(docx_path, tmp_dir)
            pdf_filename = f"{name}_Resume.pdf"
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
        raise HTTPException(status_code=500, detail=f"Failed to render resume: {e}")

    return FileResponse(
        path=docx_path,
        media_type=DOCX_MEDIA_TYPE,
        filename=docx_filename,
        background=BackgroundTask(shutil.rmtree, tmp_dir, ignore_errors=True),
    )
