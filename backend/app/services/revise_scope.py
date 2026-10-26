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


MAX_SKILL_GROUPS = 15
MAX_ITEMS_PER_GROUP = 40


def _clean_groups(groups) -> list[dict] | None:
    """Normalized [{label, items}] or None if the shape is invalid."""
    if not isinstance(groups, list) or not 1 <= len(groups) <= MAX_SKILL_GROUPS:
        return None
    cleaned = []
    for g in groups:
        if not isinstance(g, dict):
            return None
        label, items = g.get("label"), g.get("items")
        if not isinstance(label, str) or not label.strip() or not isinstance(items, list):
            return None
        if not all(isinstance(i, str) for i in items):
            return None
        items = [i.strip() for i in items if i.strip()]
        if not items or len(items) > MAX_ITEMS_PER_GROUP:
            return None
        cleaned.append({"label": label.strip(), "items": items})
    return cleaned


def _group_signature(label: str, items: list[str]) -> tuple:
    return (label.strip().casefold(), tuple(i.strip().casefold() for i in items))


def filter_skills_replace(result: dict, resume: dict, selected_ids: list[str]) -> dict:
    """Validate a whole-section skills replace. Allowed for a skills section that is in
    scope: the whole document, the section itself, or one of its groups. When only some
    groups are selected, every unselected group must come back unchanged. Updates and
    removals aimed at that section's groups are dropped either way, so a structural edit is
    never half-applied or applied positionally. An invalid replace leaves the section as
    it was."""
    replace = result.get("skills_replace")
    result["skills_replace"] = None
    if not isinstance(replace, dict):
        return result

    skills_sections = [s for s in resume.get("sections", []) or [] if s.get("type") == "skills"]
    section = next((s for s in skills_sections if s.get("id") == replace.get("section")), None)
    if section is None and len(skills_sections) == 1:
        # A wrong section id with only one skills section: that's the one meant.
        section = skills_sections[0]
    if section is None:
        # Unresolvable: still drop per-group edits in every skills section, so a structural
        # request can't fall back to positional updates.
        ids = {i for s in skills_sections for g in s.get("groups", []) or []
               for i in [g["id"], *(it["id"] for it in g.get("items", []) or [])]}
        result["updates"] = [u for u in result.get("updates", []) if u.get("id") not in ids]
        result["removals"] = [r for r in result.get("removals", []) if r not in ids]
        return result

    group_ids = {g["id"] for g in section.get("groups", []) or []}
    item_ids = {i["id"] for g in section.get("groups", []) or [] for i in g.get("items", []) or []}
    section_ids = group_ids | item_ids | {section["id"]}
    # Whatever happens to the replace, don't also apply per-group edits to this section.
    result["updates"] = [u for u in result.get("updates", []) if u.get("id") not in section_ids]
    result["removals"] = [r for r in result.get("removals", []) if r not in group_ids | item_ids]

    selected = set(selected_ids)
    whole = not selected_ids
    selected_groups = group_ids & selected
    if not (whole or section["id"] in selected or selected_groups):
        return result

    groups = _clean_groups(replace.get("groups"))
    if groups is None:
        return result

    if not (whole or section["id"] in selected):
        # Only some groups selected: the others must survive unchanged.
        new_sigs = [_group_signature(g["label"], g["items"]) for g in groups]
        for g in section.get("groups", []) or []:
            if g["id"] in selected_groups:
                continue
            sig = _group_signature(g["label"], [i["text"] for i in g.get("items", []) or []])
            if sig not in new_sigs:
                return result
            new_sigs.remove(sig)

    result["skills_replace"] = {"section": section["id"], "groups": groups}
    return result
