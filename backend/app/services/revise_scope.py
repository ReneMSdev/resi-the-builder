"""Which IDs a /revise request may remove or add next to, and filtering of the model's
updates, removals and additions.

These only ever change the document sent with the request (a tailored resume or cover
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


# Sections whose entries display bullets. Education/certification entries render as a
# single line, so a bullet added there would never be shown.
_BULLET_SECTION_EXCLUDED = ("skills", "education", "certifications")
MAX_ADDITIONS = 20


def resume_addition_anchors(resume: dict, selected_ids: list[str]) -> set[str]:
    """IDs a new bullet may be anchored to: bullets (insert after) and entries (append),
    in bullet-bearing sections, within the selection (or anywhere for an empty one)."""
    whole = not selected_ids
    selected = set(selected_ids)
    anchors: set[str] = set()
    for section, entries, _groups in _resume_tree(resume):
        if section.get("type") in _BULLET_SECTION_EXCLUDED:
            continue
        section_in = whole or section["id"] in selected
        for entry in entries:
            entry_in = section_in or entry["id"] in selected
            if entry_in:
                anchors.add(entry["id"])
            for bullet in entry.get("bullets", []) or []:
                if entry_in or bullet["id"] in selected:
                    anchors.add(bullet["id"])
    return anchors


def cover_letter_addition_anchors(cover_letter: dict, selected_ids: list[str]) -> set[str]:
    return cover_letter_removable_ids(cover_letter, selected_ids)


def all_ids(value) -> set[str]:
    """Every "id" anywhere in a document."""
    found: set[str] = set()
    if isinstance(value, dict):
        if isinstance(value.get("id"), str):
            found.add(value["id"])
        for v in value.values():
            found |= all_ids(v)
    elif isinstance(value, list):
        for v in value:
            found |= all_ids(v)
    return found


def filter_additions_and_unknown_updates(
    result: dict, doc: dict, anchors: set[str], update_scope: set[str], covered
) -> dict:
    """Keep only text updates for IDs that exist in the document and are inside the
    selection's scope (so a model can't invent IDs or shift text into other items, e.g. to
    make room for a split), and only additions with an in-scope anchor and non-empty text.
    Run after filter_removals; `covered(removals)` gives removed IDs plus everything nested
    under them, so anchors inside removed items are dropped too."""
    allowed_updates = all_ids(doc) & update_scope
    result["updates"] = [
        u for u in result.get("updates", [])
        if isinstance(u, dict) and u.get("id") in allowed_updates
    ]
    removals = result.get("removals", [])
    removed = covered(removals) if removals else set()
    kept = []
    for a in result.get("additions", []) or []:
        if not isinstance(a, dict):
            continue
        after, text = a.get("after"), a.get("text")
        if (isinstance(after, str) and after in anchors and after not in removed
                and isinstance(text, str) and text.strip()):
            kept.append({"after": after, "text": text.strip()})
    result["additions"] = kept[:MAX_ADDITIONS]
    return result


def resume_update_scope(resume: dict, selected_ids: list[str]) -> set[str]:
    """IDs a text update may target: each selected ID itself, plus the bullets under a
    selected entry, and the bullets and skill groups under a selected section. An empty
    selection means the whole document."""
    if not selected_ids:
        return all_ids(resume)
    selected = set(selected_ids)
    scope = set(selected)
    for section, entries, groups in _resume_tree(resume):
        section_in = section["id"] in selected
        for entry in entries:
            if section_in or entry["id"] in selected:
                scope.update(b["id"] for b in entry.get("bullets", []) or [])
        if section_in:
            scope.update(g["id"] for g in groups)
    return scope


def cover_letter_update_scope(cover_letter: dict, selected_ids: list[str]) -> set[str]:
    return all_ids(cover_letter) if not selected_ids else set(selected_ids)
