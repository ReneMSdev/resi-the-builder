from pydantic import BaseModel
from typing import Optional


class IdText(BaseModel):
    """Generic {id, text} unit for any single revisable/editable text field —
    meta fields, entry fields, skill items, cover-letter salutation/sign-off, etc."""
    id: str
    text: str


class Link(BaseModel):
    id: str
    label: str
    url: str


class Meta(BaseModel):
    name: IdText
    email: IdText
    phone: IdText
    links: list[Link] = []


class Bullet(BaseModel):
    id: str
    text: str
    tags: list[str] = []


class Entry(BaseModel):
    id: str
    title: IdText
    organization: IdText
    location: IdText
    dates: IdText
    bullets: list[Bullet] = []


class SkillItem(IdText):
    pass


class SkillGroup(BaseModel):
    id: str
    label: str
    items: list[SkillItem]


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
    name: IdText
    email: IdText
    phone: IdText
    date: IdText
    company: IdText
    role: IdText


class Paragraph(BaseModel):
    id: str
    text: str


class CoverLetter(BaseModel):
    type: str = "cover_letter"
    meta: CoverLetterMeta
    salutation: IdText = IdText(id="cl_salutation", text="Dear Hiring Manager,")
    sign_off: IdText = IdText(id="cl_sign_off", text="Sincerely,")
    paragraphs: list[Paragraph]


class GenerateRequest(BaseModel):
    job_description: str
    company_context: Optional[str] = None
    type: str = "resume"  # "resume" | "cover_letter"


class GenerateResponse(BaseModel):
    resume: Optional[Resume] = None
    cover_letter: Optional[CoverLetter] = None
    cleaned_job_description: Optional[str] = None


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


class SavedItem(BaseModel):
    id: str
    name: str
    type: str  # "resume" | "cover_letter"
    created_at: str
    data: dict  # already validated once by the caller before saving; keep loose here


class SaveRequest(BaseModel):
    name: Optional[str] = None
    type: str
    data: dict
