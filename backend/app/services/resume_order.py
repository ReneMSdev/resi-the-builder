"""Deterministic ordering applied to generated resumes.

Certification and education entries are sorted newest first. "In Progress" (or "Present",
"Expected", "Current") counts as the newest; undated entries go last. The sort is stable,
so entries with the same date keep the order generation gave them.
"""
import re

SORTED_SECTION_TYPES = ("certifications", "education")

_ONGOING = re.compile(r"\b(in progress|present|current|expected|ongoing)\b", re.IGNORECASE)
_YEAR = re.compile(r"\b(19|20)\d{2}\b")
_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1
)}


def _date_key(dates_text: str) -> tuple:
    """Lower sorts first: (0,) ongoing, (1, -year, -month) dated, (2,) undated. For a range
    like "2016 - 2020" the end date counts."""
    text = (dates_text or "").strip()
    if _ONGOING.search(text):
        return (0,)
    years = [m.group(0) for m in _YEAR.finditer(text)]
    if not years:
        return (2,)
    last_year = years[-1]
    tail = text[text.rfind(last_year) - 12 : text.rfind(last_year)].lower()
    month = max((n for name, n in _MONTHS.items() if name in tail), default=0)
    return (1, -int(last_year), -month)


def sort_dated_sections(resume: dict) -> dict:
    for section in resume.get("sections", []) or []:
        if section.get("type") in SORTED_SECTION_TYPES and section.get("entries"):
            section["entries"] = sorted(
                section["entries"], key=lambda e: _date_key((e.get("dates") or {}).get("text", ""))
            )
    return resume
