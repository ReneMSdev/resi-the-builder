"""Which IDs a /revise request may remove, and filtering of the model's removals.

Removals only ever change the document sent with the request (a tailored resume or cover
letter in the frontend's state). Nothing here touches stored data or profile.json.

An empty selected_ids list means "the whole document".
"""


def _resume_tree(resume: dict):
    """Yield (section, entries, groups) for each section."""
    for section in resume.get("sections", []) or []:
        yield section, section.get("entries", []) or [], section.get("groups", []) or []


def resume_removable_ids(resume: dict, selected_ids: list[str]) -> set[str]:
    """Removable units: sections, entries, bullets, skill groups, skill items and links.
    The summary, meta fields and entry fields (title, dates, ...) are never removable."""
    whole = not selected_ids
    selected = set(selected_ids)
    allowed: set[str] = set()

    for section, entries, groups in _resume_tree(resume):
        section_in = whole or section["id"] in selected
        if section_in:
            allowed.add(section["id"])
        for entry in entries:
            entry_in = section_in or entry["id"] in selected
            if entry_in:
                allowed.add(entry["id"])
            for bullet in entry.get("bullets", []) or []:
                if entry_in or bullet["id"] in selected:
                    allowed.add(bullet["id"])
        for group in groups:
            group_in = section_in or group["id"] in selected
            if group_in:
                allowed.add(group["id"])
            for item in group.get("items", []) or []:
                if group_in or item["id"] in selected:
                    allowed.add(item["id"])

    for link in (resume.get("meta") or {}).get("links", []) or []:
        if whole or link["id"] in selected:
            allowed.add(link["id"])

    return allowed


def cover_letter_removable_ids(cover_letter: dict, selected_ids: list[str]) -> set[str]:
    """Only paragraphs are removable; salutation, sign-off and meta fields are not."""
    whole = not selected_ids
    selected = set(selected_ids)
    return {
        p["id"]
        for p in cover_letter.get("paragraphs", []) or []
        if whole or p["id"] in selected
    }


def filter_removals(result: dict, allowed: set[str], covered) -> dict:
    """Keep only removals in scope (deduplicated, in order), and drop any text update for
    an ID that is removed or sits inside something removed. `covered(removals)` returns
    the removed IDs plus everything nested under them."""
    seen: set[str] = set()
    removals = []
    for rid in result.get("removals", []) or []:
        if isinstance(rid, str) and rid in allowed and rid not in seen:
            seen.add(rid)
            removals.append(rid)
    result["removals"] = removals
    gone = covered(removals) if removals else set()
    result["updates"] = [u for u in result.get("updates", []) if u.get("id") not in gone]
    return result
