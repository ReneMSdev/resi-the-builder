"""Contact links for cover letters, copied from the profile in code (never written by
the model). Only LinkedIn and the personal website go on a cover letter's contact line."""

COVER_LETTER_LINK_LABELS = ("linkedin", "website")


def cover_letter_links(profile: dict) -> list[dict]:
    links = (profile.get("meta") or {}).get("links", []) or []
    return [
        {"id": link["id"], "label": link["label"], "url": link["url"]}
        for label in COVER_LETTER_LINK_LABELS
        for link in links
        if (link.get("label") or "").strip().lower() == label and link.get("url")
    ]


def add_cover_letter_links(cover_letter: dict, profile: dict) -> dict:
    cover_letter.setdefault("meta", {})["links"] = cover_letter_links(profile)
    return cover_letter
