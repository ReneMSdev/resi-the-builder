import { Application, CoverLetter, Resume } from "../types";

function formatResumeBody(resume: Resume): string {
  const parts: string[] = [];
  if (resume.summary.text) {
    parts.push(resume.summary.text, "");
  }
  for (const section of resume.sections) {
    const hasEntries = section.entries && section.entries.length > 0;
    const hasGroups = section.groups && section.groups.length > 0;
    if (!hasEntries && !hasGroups) continue;

    parts.push(`${section.title.toUpperCase()}:`);
    for (const entry of section.entries ?? []) {
      const header = [entry.title.text, entry.organization.text]
        .filter(Boolean)
        .join(" — ");
      const dates = entry.dates.text ? ` (${entry.dates.text})` : "";
      const location = entry.location.text ? `, ${entry.location.text}` : "";
      parts.push(`- ${header}${location}${dates}`);
      for (const bullet of entry.bullets ?? []) {
        parts.push(`  • ${bullet.text}`);
      }
    }
    for (const group of section.groups ?? []) {
      parts.push(`- ${group.label}: ${group.items.map((i) => i.text).join(", ")}`);
    }
    parts.push("");
  }
  return parts.join("\n").trim();
}

function formatCoverLetterBody(coverLetter: CoverLetter): string {
  const parts: string[] = [];
  if (coverLetter.salutation.text) parts.push(coverLetter.salutation.text, "");
  for (const paragraph of coverLetter.paragraphs) {
    parts.push(paragraph.text, "");
  }
  if (coverLetter.sign_off.text) parts.push(coverLetter.sign_off.text);
  return parts.join("\n").trim();
}

export function buildAutoApplyPrompt({
  application,
  url,
  extraInstructions,
  apiUrl,
}: {
  application: Application;
  url: string;
  extraInstructions: string;
  apiUrl: string;
}): string {
  const contactSource = application.resume?.meta ?? application.cover_letter?.meta;
  const dataDir = `backend/app/data/applications/${application.id}`;
  const lines: string[] = [];

  lines.push("# Job application fill-in task");
  lines.push("");
  lines.push(
    "**SAFETY RULE — absolute, does not get relaxed for any reason during this task:** " +
      "this is a FILL-ONLY task. Fill in text fields and upload files using Claude-in-Chrome, " +
      "but do NOT click Submit, Apply, or any equivalent final-submission control. " +
      "Stop once the form is filled in and hand back to the human for review — " +
      "the human submits the application themselves, never this automation.",
  );
  lines.push("");

  lines.push("## Application form URL");
  lines.push(url);
  lines.push("");

  lines.push(`## Package: ${application.name}`);
  lines.push("");

  if (extraInstructions.trim()) {
    lines.push("## Extra instructions for this application");
    lines.push(extraInstructions.trim());
    lines.push("");
  }

  lines.push("## Contact info");
  if (contactSource) {
    lines.push(`- Name: ${contactSource.name.text}`);
    lines.push(`- Email: ${contactSource.email.text}`);
    lines.push(`- Phone: ${contactSource.phone.text}`);
    for (const link of application.resume?.meta.links ?? []) {
      lines.push(`- ${link.label || "Link"}: ${link.url}`);
    }
  } else {
    lines.push("(none available — this package has no resume or cover letter saved)");
  }
  lines.push("");

  lines.push("## Files to upload");
  if (application.resume) {
    lines.push(`- Resume: ${dataDir}/resume.docx`);
  }
  if (application.cover_letter) {
    lines.push(`- Cover letter: ${dataDir}/cover_letter.docx`);
  }
  if (!application.resume && !application.cover_letter) {
    lines.push("(none — this package has neither a resume nor a cover letter saved)");
  }
  lines.push("");

  if (application.resume) {
    lines.push("## Resume content (for reference, e.g. answering screening questions)");
    lines.push(formatResumeBody(application.resume));
    lines.push("");
  }

  if (application.cover_letter) {
    lines.push("## Cover letter content");
    lines.push(formatCoverLetterBody(application.cover_letter));
    lines.push("");
  }

  lines.push("## Job description");
  lines.push("");
  lines.push("### Cleaned");
  lines.push(application.job_description.cleaned || "(none — use the raw text below)");
  lines.push("");
  lines.push("### Raw");
  lines.push(application.job_description.raw);
  lines.push("");

  lines.push("## Backend reference");
  lines.push(
    `The resume-builder backend is running at ${apiUrl}. If you need to re-fetch this ` +
      `package directly: GET ${apiUrl}/applications/${application.id}`,
  );
  lines.push("");

  lines.push("## Steps");
  lines.push("1. Navigate to the application form URL above using Claude-in-Chrome.");
  lines.push(
    "2. Fill in all text fields (name, email, phone, links, and any screening questions) " +
      "using the contact info, resume/cover-letter content, and extra instructions above.",
  );
  lines.push("3. Upload the resume and/or cover letter files listed above wherever the form asks for them.");
  lines.push(
    "4. Once everything is filled in, STOP and report back to the human for review. " +
      "Do NOT click Submit, Apply, or any equivalent final-submission control under any circumstances.",
  );

  return lines.join("\n");
}
