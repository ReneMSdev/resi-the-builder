import os
import json
from anthropic import Anthropic

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MODEL = "claude-sonnet-4-6"

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
  "meta": { "name": "...", "email": "...", "phone": "...", "links": [...] },
  "summary": { "id": "summary", "text": "..." },
  "sections": [
    {
      "id": "sec_...",
      "title": "...",
      "type": "experience|projects|education|certifications|skills",
      "entries": [
        {
          "id": "entry_...",
          "title": "...",
          "organization": "...",
          "location": "...",
          "dates": "...",
          "bullets": [ { "id": "b_...", "text": "...", "tags": [...] } ]
        }
      ],
      "groups": [ { "id": "skill_...", "label": "...", "items": [...] } ]
    }
  ]
}

Generate new unique ids for the summary and any reworded bullets (prefix with a short
random suffix to avoid collisions, e.g. "b_salo_1_r2"). Keep ids for entries/sections
that map directly to profile entries so downstream tooling can trace them. Include a
"groups" array only for sections of type "skills"; use an empty "entries" array for
skills sections. Omit sections that have no relevant content for this job rather than
including empty ones.
"""


def generate_resume(profile: dict, job_description: str, company_context: str | None = None) -> dict:
    user_content = f"""PROFILE DATA:
{json.dumps(profile, indent=2)}

JOB DESCRIPTION:
{job_description}
"""
    if company_context:
        user_content += f"\nADDITIONAL COMPANY/ROLE CONTEXT:\n{company_context}\n"

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=GENERATE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    text = "".join(block.text for block in response.content if block.type == "text").strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Model did not return valid JSON: {e}\nRaw output:\n{text[:500]}")
