import os
import json
from anthropic import Anthropic

from app.services.usage_guard import check_and_increment

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MODEL = "claude-sonnet-4-6"
MAX_INPUT_CHARS = 20000

GENERATE_SYSTEM_PROMPT = """You are a resume-tailoring assistant. You will be given:
1. A candidate's full profile data (all their jobs, projects, education, certifications, skills)
2. A job description they are applying to
3. Optional extra context about the company/role

Your job: select and rewrite the most relevant content from the profile to produce a
tailored resume for this specific job. Prioritize bullets whose tags or content match
the job description's requirements. Rewrite bullet text to naturally incorporate keywords
from the job description where truthful and accurate — do not fabricate skills, numbers,
or experience not present in the profile.

Return ONLY valid JSON matching this exact structure (no markdown fences, no preamble):

{
  "type": "resume",
  "meta": {
    "name": { "id": "meta_name", "text": "..." },
    "email": { "id": "meta_email", "text": "..." },
    "phone": { "id": "meta_phone", "text": "..." },
    "links": [ { "id": "link_...", "label": "...", "url": "..." } ]
  },
  "summary": { "id": "summary", "text": "..." },
  "sections": [
    {
      "id": "sec_...",
      "title": "...",
      "type": "experience|projects|education|certifications|skills",
      "entries": [
        {
          "id": "entry_...",
          "title": { "id": "entry_..._title", "text": "..." },
          "organization": { "id": "entry_..._org", "text": "..." },
          "location": { "id": "entry_..._location", "text": "..." },
          "dates": { "id": "entry_..._dates", "text": "..." },
          "bullets": [ { "id": "b_...", "text": "...", "tags": [...] } ]
        }
      ],
      "groups": [
        {
          "id": "skill_...",
          "label": "...",
          "items": [ { "id": "item_...", "text": "..." } ]
        }
      ]
    }
  ]
}

Generate new unique ids for the summary and any reworded bullets (prefix with a short
random suffix to avoid collisions, e.g. "b_salo_1_r2"). Keep ids for entries/sections
that map directly to profile entries so downstream tooling can trace them. Every
meta/entry field, skill item, and link is an object with its own "id" field (not a bare
string) — generate a short, readable, unique id for each, reusing the profile's existing
ids where a value is carried over unchanged. Naming convention: "meta_name"/"meta_email"/
"meta_phone" for the top-level meta fields (always exactly these three ids — there is
only one meta object per resume); "item_<group-slug>_<word>" for skill items and
"link_<label-slug>" for links (as before); and for entry fields, suffix that entry's own
id with "_title"/"_org"/"_location"/"_dates" (e.g. entry "entry_salolabs" →
"entry_salolabs_title", "entry_salolabs_org", "entry_salolabs_location",
"entry_salolabs_dates"). Include a "groups" array only for sections of type "skills"; use
an empty "entries" array for skills sections. Omit sections that have no relevant content
for this job rather than including empty ones.
"""


REVISE_SYSTEM_PROMPT = """You are a resume-editing assistant. You will be given:
1. The full current resume JSON (for context and consistency of tone/voice)
2. A list of selected IDs the user wants revised
3. A free-text instruction describing how to revise them (e.g. "make these punchier and
   quantify impact", "shorten to one line", "emphasize leadership")

Each selected ID refers to something in the resume JSON:
- A bullet ID (e.g. "b_salo_2") — revise that single bullet's text per the instruction.
- The summary ID ("summary") — revise the summary text per the instruction.
- A meta field ID ("meta_name", "meta_email", "meta_phone") or a link ID (e.g.
  "link_github") — revise that single field's "text" per the instruction, same as a
  bullet. These are plain single-line strings, not lists — no comma-joining involved.
- An entry field ID (e.g. "entry_salolabs_title", "entry_salolabs_org",
  "entry_salolabs_location", "entry_salolabs_dates") — revise that single field's "text"
  per the instruction, same as a meta field.
- An entry ID (e.g. "entry_salolabs") — this means "revise this whole job/project block."
  In this case, apply the instruction across ALL bullets currently under that entry, and
  return one update per bullet using each bullet's OWN id (not the entry's id) — the
  entry id itself is not a directly revisable field and must not appear in your output.
  If the entry has no bullets (e.g. an education or certification entry with an empty
  bullets list), there is nothing to revise — skip that id entirely, do not invent bullets.
  (Note: this bullet-expansion behavior is unchanged — an entry ID never implicitly pulls
  in that entry's title/organization/location/dates fields; those are only revised when
  their own specific field ID is selected directly.)
- A skill group ID (e.g. "skill_devops") — a group's current state is its "items" array;
  read each item's "text" field, join them with ", " (comma + space) in their existing
  order to form one string, then apply the instruction to that whole comma-separated
  string as if it were a single line of text (e.g. adding a skill means appending it to
  the list, removing one means dropping it from the list, rewording means rewording the
  list as a whole). Return ONE update for the group, keyed by the group's OWN id, with
  "text" set to the revised comma-separated string — do NOT return per-item ids or an
  "items" array; the response shape is still the flat {id, text} pair used everywhere else.
- A section ID (e.g. "sec_experience") — this means "revise every bullet in every entry
  under this section." Apply the instruction across ALL bullets in ALL entries belonging
  to that section, and return one update per bullet using each bullet's OWN id (not the
  section's id, and not any entry id either) — the section id itself must not appear in
  your output. If the section has no bullet-bearing entries (e.g. an "education"/
  "certifications" section whose entries have no bullets), there is nothing to revise —
  skip that id entirely, do not invent bullets.
- A "skills"-type section ID (e.g. "sec_skills", identified by that section's "type"
  field being "skills") — this means "revise every skill group in this section." Apply
  the instruction across ALL groups belonging to that section, and return one update per
  group using each group's OWN id, following the same comma-separated-string convention
  described above for a single skill group ID. The section id itself must not appear in
  your output.

Rules:
- Only touch the text of the exact IDs implied above. Never modify, rewrite, or return
  anything for IDs that were not selected (directly or via an entry/group/section
  expansion).
- Do not fabricate new facts, numbers, skills, or experience not already present in the
  resume JSON's existing content. Only rephrase/restructure what's already there — the
  one exception is a skill group/section instruction that explicitly names a new skill to
  add (e.g. "add Kubernetes to this list"), since the user is directly supplying that fact.
- Preserve the existing tone/voice of the resume unless the instruction says otherwise.

Return ONLY valid JSON matching this exact structure (no markdown fences, no preamble):

{
  "updates": [
    { "id": "b_salo_2", "text": "revised text here" },
    { "id": "skill_devops", "text": "Docker, GitHub Actions CI/CD, Terraform, Linux, Kubernetes" }
  ]
}

If none of the selected IDs have anything to revise (e.g. every selected id was an
education/certifications section or entry with no bullets), return {"updates": []} —
always include the "updates" key, even when it's an empty list.
"""


COVER_LETTER_SYSTEM_PROMPT = """You are a cover-letter-writing assistant. You will be given:
1. A candidate's full profile data (all their jobs, projects, education, certifications, skills)
2. A job description they are applying to
3. Optional extra context about the company/role

Your job: write a tailored, professional cover letter for this specific job, grounded
only in real experience present in the profile data — do not fabricate skills, numbers,
achievements, or experience not present in the profile. Extract the company name and
role title from the job description if present (leave blank in meta if genuinely
unclear rather than guessing). The letter should be 3-4 paragraphs: an opening stating
the role and genuine interest, one or two body paragraphs connecting specific profile
experience to the job's stated requirements, and a closing paragraph. Keep it concise
professional business-letter tone, not generic filler — reference specific, real
accomplishments from the profile data rather than vague claims.

Return ONLY valid JSON matching this exact structure (no markdown fences, no preamble):

{
  "type": "cover_letter",
  "meta": {
    "name": { "id": "cl_meta_name", "text": "..." },
    "email": { "id": "cl_meta_email", "text": "..." },
    "phone": { "id": "cl_meta_phone", "text": "..." },
    "date": { "id": "cl_meta_date", "text": "" },
    "company": { "id": "cl_meta_company", "text": "..." },
    "role": { "id": "cl_meta_role", "text": "..." }
  },
  "salutation": { "id": "cl_salutation", "text": "Dear Hiring Manager," },
  "sign_off": { "id": "cl_sign_off", "text": "Sincerely," },
  "paragraphs": [
    { "id": "p1", "text": "..." },
    { "id": "p2", "text": "..." }
  ]
}

Every meta field is an object with its own "id" field (not a bare string) — always use
exactly these six ids for meta ("cl_meta_name", "cl_meta_email", "cl_meta_phone",
"cl_meta_date", "cl_meta_company", "cl_meta_role"), since there is only one meta object
per cover letter. Leave "date"'s text as an empty string — the frontend will fill in the
actual date. Generate sequential paragraph ids (p1, p2, p3, ...). Always include
"salutation" and "sign_off" as shown, with ids "cl_salutation"/"cl_sign_off" — default
their text to "Dear Hiring Manager," and "Sincerely," respectively unless a specific
hiring manager's name is clearly given in the job description, in which case address them
by name (e.g. "Dear Jane Smith,"). Do not fold the salutation or sign-off into the
paragraphs array — they are separate fields, and paragraphs should contain only the body.
"""


COVER_LETTER_REVISE_SYSTEM_PROMPT = """You are a cover-letter-editing assistant. You will be given:
1. The full current cover letter JSON (for context and consistency of tone/voice)
2. A list of selected IDs the user wants revised
3. A free-text instruction describing how to revise them (e.g. "make this punchier",
   "shorten to two sentences", "emphasize leadership")

Each selected ID refers to something in the cover letter JSON:
- A paragraph ID (e.g. "p2") from the "paragraphs" array — revise that paragraph's text
  per the instruction.
- A meta field ID ("cl_meta_name", "cl_meta_email", "cl_meta_phone", "cl_meta_date",
  "cl_meta_company", "cl_meta_role") — revise that single field's "text" per the
  instruction. These are plain single-line strings, e.g. rewording the role title.
- The salutation ID ("cl_salutation") or sign-off ID ("cl_sign_off") — revise that
  field's "text" per the instruction (e.g. "address it to Jane Smith by name" on
  "cl_salutation" should produce something like "Dear Jane Smith,").

Rules:
- Only touch the text of the exact IDs selected. Never modify, rewrite, or return
  anything for IDs that were not selected.
- Do not fabricate new facts, numbers, skills, or experience not already present in the
  cover letter JSON's existing content. Only rephrase/restructure what's already there.
- Preserve the existing tone/voice of the letter unless the instruction says otherwise.

Return ONLY valid JSON matching this exact structure (no markdown fences, no preamble):

{
  "updates": [
    { "id": "p2", "text": "revised text here" }
  ]
}

If none of the selected IDs have anything to revise, return {"updates": []} — always
include the "updates" key, even when it's an empty list.
"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Model did not return valid JSON: {e}\nRaw output:\n{text[:500]}")


def _normalize_revise_result(result: dict) -> dict:
    """Defensively ensure the "updates" key is always present, since the model
    sometimes returns bare {} instead of {"updates": []} when there's nothing to
    revise — don't rely on prompt wording alone to guarantee this shape."""
    result.setdefault("updates", [])
    return result


def generate_resume(profile: dict, job_description: str, company_context: str | None = None) -> dict:
    if len(job_description) > MAX_INPUT_CHARS:
        raise ValueError(f"job_description exceeds the {MAX_INPUT_CHARS}-character limit.")
    if company_context and len(company_context) > MAX_INPUT_CHARS:
        raise ValueError(f"company_context exceeds the {MAX_INPUT_CHARS}-character limit.")

    check_and_increment()

    user_content = f"""PROFILE DATA:
{json.dumps(profile, indent=2)}

JOB DESCRIPTION:
{job_description}
"""
    if company_context:
        user_content += f"\nADDITIONAL COMPANY/ROLE CONTEXT:\n{company_context}\n"

    response = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        system=GENERATE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    text = "".join(block.text for block in response.content if block.type == "text")
    return _extract_json(text)


def generate_cover_letter(profile: dict, job_description: str, company_context: str | None = None) -> dict:
    if len(job_description) > MAX_INPUT_CHARS:
        raise ValueError(f"job_description exceeds the {MAX_INPUT_CHARS}-character limit.")
    if company_context and len(company_context) > MAX_INPUT_CHARS:
        raise ValueError(f"company_context exceeds the {MAX_INPUT_CHARS}-character limit.")

    check_and_increment()

    user_content = f"""PROFILE DATA:
{json.dumps(profile, indent=2)}

JOB DESCRIPTION:
{job_description}
"""
    if company_context:
        user_content += f"\nADDITIONAL COMPANY/ROLE CONTEXT:\n{company_context}\n"

    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=COVER_LETTER_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    text = "".join(block.text for block in response.content if block.type == "text")
    return _extract_json(text)


def revise_resume(resume: dict, selected_ids: list[str], instruction: str) -> dict:
    if len(instruction) > MAX_INPUT_CHARS:
        raise ValueError(f"instruction exceeds the {MAX_INPUT_CHARS}-character limit.")

    check_and_increment()

    user_content = f"""CURRENT RESUME JSON:
{json.dumps(resume, indent=2)}

SELECTED IDS:
{json.dumps(selected_ids)}

INSTRUCTION:
{instruction}
"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=REVISE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    text = "".join(block.text for block in response.content if block.type == "text")
    return _normalize_revise_result(_extract_json(text))


def revise_cover_letter(cover_letter: dict, selected_ids: list[str], instruction: str) -> dict:
    if len(instruction) > MAX_INPUT_CHARS:
        raise ValueError(f"instruction exceeds the {MAX_INPUT_CHARS}-character limit.")

    check_and_increment()

    user_content = f"""CURRENT COVER LETTER JSON:
{json.dumps(cover_letter, indent=2)}

SELECTED IDS:
{json.dumps(selected_ids)}

INSTRUCTION:
{instruction}
"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=COVER_LETTER_REVISE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    text = "".join(block.text for block in response.content if block.type == "text")
    return _normalize_revise_result(_extract_json(text))
