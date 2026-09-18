import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response

from app.models import Application, CreateApplicationRequest
from app.services.render import render_resume_docx, render_cover_letter_docx

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "applications"


def _dir_for(item_id: str) -> Path:
    return DATA_DIR / item_id


def _default_name(cover_letter: dict | None, created_at: str) -> str:
    if cover_letter:
        meta = cover_letter.get("meta", {}) or {}
        company = ((meta.get("company") or {}).get("text") or "").strip()
        role = ((meta.get("role") or {}).get("text") or "").strip()
        if company and role:
            return f"{company} — {role}"
        if company:
            return company
        if role:
            return role

    created = datetime.fromisoformat(created_at)
    return f"Application — {created.strftime('%Y-%m-%d %H:%M')}"


@router.post("/applications", response_model=Application)
def create_application(req: CreateApplicationRequest):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    item_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()

    resume_dict = req.resume.model_dump() if req.resume else None
    cover_letter_dict = req.cover_letter.model_dump() if req.cover_letter else None

    name = req.name.strip() if req.name else ""
    if not name:
        name = _default_name(cover_letter_dict, created_at)

    folder = _dir_for(item_id)
    folder.mkdir(parents=True, exist_ok=True)

    try:
        with open(folder / "job_description.txt", "w") as f:
            f.write(req.job_description.raw)
        if req.job_description.cleaned:
            with open(folder / "job_description_cleaned.txt", "w") as f:
                f.write(req.job_description.cleaned)

        if resume_dict is not None:
            with open(folder / "resume.json", "w") as f:
                json.dump(resume_dict, f, indent=2)
            render_resume_docx(resume_dict, str(folder / "resume.docx"))

        if cover_letter_dict is not None:
            with open(folder / "cover_letter.json", "w") as f:
                json.dump(cover_letter_dict, f, indent=2)
            render_cover_letter_docx(cover_letter_dict, str(folder / "cover_letter.docx"))

        with open(folder / "meta.json", "w") as f:
            json.dump({"id": item_id, "name": name, "created_at": created_at}, f, indent=2)
    except Exception as e:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to create application: {e}")

    return {
        "id": item_id,
        "name": name,
        "created_at": created_at,
        "job_description": {"raw": req.job_description.raw, "cleaned": req.job_description.cleaned},
        "resume": resume_dict,
        "cover_letter": cover_letter_dict,
    }


@router.get("/applications")
def list_applications():
    if not DATA_DIR.exists():
        return []

    summaries = []
    for folder in DATA_DIR.iterdir():
        meta_path = folder / "meta.json"
        if not folder.is_dir() or not meta_path.exists():
            continue
        with open(meta_path, "r") as f:
            meta = json.load(f)
        summaries.append({
            "id": meta["id"],
            "name": meta["name"],
            "created_at": meta["created_at"],
            "has_resume": (folder / "resume.json").exists(),
            "has_cover_letter": (folder / "cover_letter.json").exists(),
        })
    summaries.sort(key=lambda s: s["created_at"], reverse=True)
    return summaries


@router.get("/applications/{item_id}", response_model=Application)
def get_application(item_id: str):
    folder = _dir_for(item_id)
    meta_path = folder / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Application not found")

    with open(meta_path, "r") as f:
        meta = json.load(f)

    raw_path = folder / "job_description.txt"
    raw = raw_path.read_text() if raw_path.exists() else ""

    cleaned_path = folder / "job_description_cleaned.txt"
    cleaned = cleaned_path.read_text() if cleaned_path.exists() else None

    resume = None
    resume_path = folder / "resume.json"
    if resume_path.exists():
        with open(resume_path, "r") as f:
            resume = json.load(f)

    cover_letter = None
    cl_path = folder / "cover_letter.json"
    if cl_path.exists():
        with open(cl_path, "r") as f:
            cover_letter = json.load(f)

    return {
        "id": meta["id"],
        "name": meta["name"],
        "created_at": meta["created_at"],
        "job_description": {"raw": raw, "cleaned": cleaned},
        "resume": resume,
        "cover_letter": cover_letter,
    }


@router.delete("/applications/{item_id}", status_code=204)
def delete_application(item_id: str):
    folder = _dir_for(item_id)
    if not folder.exists():
        raise HTTPException(status_code=404, detail="Application not found")
    shutil.rmtree(folder)
    return Response(status_code=204)
