from pydantic import BaseModel, StringConstraints
from typing import Annotated, Optional


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


class SummaryItem(IdText):
    pass


class SummaryGroup(BaseModel):
    """A pool of candidate summary paragraphs for one role type (e.g. "DevOps",
    "Technician") — mirrors SkillGroup's {id, label, items} shape exactly, just named
    for its own domain (role_type instead of label, summaries instead of items)."""
    id: str
    role_type: str
    summaries: list[SummaryItem]


class Profile(BaseModel):
    """Master data — the full universe of the candidate's experience, not tailored to any JD."""
    meta: Meta
    summary_pool: list[SummaryGroup] = []
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
    additional_context: Optional[str] = None
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
    profile: Optional[Profile] = None
    job_description: Optional[str] = None


class ReviseUpdate(BaseModel):
    id: str
    text: str


class ReviseAddition(BaseModel):
    """A new item to insert. `after` is a bullet ID (insert right after it) or an entry ID
    (append to its bullets) in a resume, or a paragraph ID in a cover letter."""
    after: str
    text: str


class SkillsReplaceGroup(BaseModel):
    label: str
    items: list[str]


class SkillsReplace(BaseModel):
    """The complete new list of skill groups for one skills section, in order. Used for
    structural changes (adding, removing, renaming, reordering groups)."""
    section: str
    groups: list[SkillsReplaceGroup]


class ReviseResponse(BaseModel):
    updates: list[ReviseUpdate]
    # IDs to delete from the document sent with the request (resume/cover letter only;
    # always empty for profile revisions). Filtered server-side to the selection's scope.
    removals: list[str] = []
    # New bullets/paragraphs to insert (resume/cover letter only), filtered the same way.
    additions: list[ReviseAddition] = []
    # Whole-section skills restructure (resume only), validated before it's returned.
    skills_replace: Optional[SkillsReplace] = None


class RenderRequest(BaseModel):
    resume: Optional[Resume] = None
    cover_letter: Optional[CoverLetter] = None
    format: str = "docx"  # "docx" or "pdf"


class JobDescription(BaseModel):
    raw: str
    cleaned: Optional[str] = None


class Application(BaseModel):
    """A saved job application package — JD plus whichever of resume/cover_letter
    exist for it. Replaces the old one-document-at-a-time SavedItem/SaveRequest
    (which stored `data` as a loose, unvalidated dict); resume/cover_letter are real
    typed fields here instead."""
    id: str
    name: str
    created_at: str
    updated_at: str
    job_description: JobDescription
    resume: Optional[Resume] = None
    cover_letter: Optional[CoverLetter] = None


class ApplicationSummary(BaseModel):
    id: str
    name: str
    created_at: str
    has_resume: bool
    has_cover_letter: bool


# Application names are trimmed before the length check, so surrounding spaces don't
# count toward the limit. The frontend mirrors the limit (APPLICATION_NAME_MAX).
APPLICATION_NAME_MAX = 120
ApplicationName = Annotated[str, StringConstraints(strip_whitespace=True, max_length=APPLICATION_NAME_MAX)]


class RenameApplicationRequest(BaseModel):
    """PATCH /job-applications/{id}: changes only the name. Blank falls back to the same
    automatic name that saving uses."""
    name: Optional[ApplicationName] = None


class CreateApplicationRequest(BaseModel):
    name: Optional[ApplicationName] = None
    job_description: JobDescription
    resume: Optional[Resume] = None
    cover_letter: Optional[CoverLetter] = None
