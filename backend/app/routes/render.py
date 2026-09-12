import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.models import RenderRequest
from app.services.render import render_resume_docx

router = APIRouter()


@router.post("/render")
def render(req: RenderRequest):
    # NOTE: rendering is pure templating (python-docx) with no Anthropic API call,
    # so this route intentionally does NOT go through usage_guard.check_and_increment().
    # It must never count against the daily LLM call cap.
    resume_dict = req.resume.model_dump()
    name = resume_dict.get("meta", {}).get("name", "Resume").replace(" ", "_")
    filename = f"{name}_Resume.docx"

    tmp_dir = tempfile.mkdtemp()
    output_path = str(Path(tmp_dir) / filename)

    try:
        render_resume_docx(resume_dict, output_path)
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to render resume: {e}")

    return FileResponse(
        path=output_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
        background=BackgroundTask(shutil.rmtree, tmp_dir, ignore_errors=True),
    )
