from pydantic import BaseModel
from typing import Optional


class Link(BaseModel):
    label: str
    url: str


class Meta(BaseModel):
    name: str
    email: str
    phone: str
    links: list[Link] = []


class Bullet(BaseModel):
    id: str
    text: str
    tags: list[str] = []


class Entry(BaseModel):
    id: str
    title: str
    organization: str
    location: str = ""
    dates: str = ""
    bullets: list[Bullet] = []


class SkillGroup(BaseModel):
    id: str
    label: str
    items: list[str]


class Section(BaseModel):
    id: str
    title: str
    type: str  # experience | projects | education | certifications | skills
    entries: list[Entry] = []
    groups: list[SkillGroup] = []  # only used when type == "skills"


class Summary(BaseModel):
    id: str = "summary"
    text: str = ""


class Resume(BaseModel):
    type: str = "resume"
    meta: Meta
    summary: Summary
    sections: list[Section]


class Profile(BaseModel):
    """Master data — the full universe of the candidate's experience, not tailored to any JD."""
    meta: Meta
    summary_pool: list[str] = []
    sections: list[Section]


class GenerateRequest(BaseModel):
    job_description: str
    company_context: Optional[str] = None


class GenerateResponse(BaseModel):
    resume: Resume


class ReviseRequest(BaseModel):
    selected_ids: list[str]
    instruction: str
    resume: Resume


class ReviseUpdate(BaseModel):
    id: str
    text: str


class ReviseResponse(BaseModel):
    updates: list[ReviseUpdate]
