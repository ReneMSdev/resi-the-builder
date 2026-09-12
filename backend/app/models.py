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


class CoverLetterMeta(BaseModel):
    name: str
    email: str
    phone: str
    date: str = ""
    company: str = ""
    role: str = ""


class Paragraph(BaseModel):
    id: str
    text: str


class CoverLetter(BaseModel):
    type: str = "cover_letter"
    meta: CoverLetterMeta
    paragraphs: list[Paragraph]


class GenerateRequest(BaseModel):
    job_description: str
    company_context: Optional[str] = None
    type: str = "resume"  # "resume" | "cover_letter"


class GenerateResponse(BaseModel):
    resume: Optional[Resume] = None
    cover_letter: Optional[CoverLetter] = None


class ReviseRequest(BaseModel):
    selected_ids: list[str]
    instruction: str
    resume: Optional[Resume] = None
    cover_letter: Optional[CoverLetter] = None


class ReviseUpdate(BaseModel):
    id: str
    text: str


class ReviseResponse(BaseModel):
    updates: list[ReviseUpdate]


class RenderRequest(BaseModel):
    resume: Optional[Resume] = None
    cover_letter: Optional[CoverLetter] = None
    format: str = "docx"  # "docx" or "pdf"
