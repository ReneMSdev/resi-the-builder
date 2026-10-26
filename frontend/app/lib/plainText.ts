import { CoverLetter, Entry, Resume } from "../types";

// Plain-text versions of the previews, for pasting into another AI or a form. They follow
// what each preview shows, in the same order, and skip empty fields.

const joinNonEmpty = (parts: (string | undefined)[], sep: string) =>
  parts.map((p) => (p ?? "").trim()).filter(Boolean).join(sep);

function entryLines(entry: Entry, withBullets: boolean): string[] {
  const heading = joinNonEmpty([entry.title.text, entry.organization.text], " — ");
  const line = joinNonEmpty([heading, entry.location.text, entry.dates.text], " | ");
  const bullets = withBullets
    ? (entry.bullets ?? []).map((b) => b.text.trim()).filter(Boolean).map((t) => `- ${t}`)
    : [];
  return [line, ...bullets].filter(Boolean);
}

export function resumeToText(resume: Resume): string {
  const { meta } = resume;
  const contact = joinNonEmpty(
    [
      meta.email.text,
      meta.phone.text,
      ...(meta.links ?? []).map((l) => (l.label ? `${l.label}: ${l.url}` : l.url)),
    ],
    " | "
  );
  const blocks: string[] = [joinNonEmpty([meta.name.text, contact], "\n")];

  if (resume.summary.text.trim()) blocks.push(`SUMMARY\n${resume.summary.text.trim()}`);

  for (const section of resume.sections) {
    const lines: string[] = [];
    if (section.type === "skills") {
      for (const group of section.groups ?? []) {
        const items = joinNonEmpty(group.items.map((i) => i.text), ", ");
        if (items) lines.push(group.label ? `${group.label}: ${items}` : items);
      }
    } else {
      const compact = section.type === "education" || section.type === "certifications";
      const entries = (section.entries ?? []).map((e) => entryLines(e, !compact).join("\n"));
      lines.push(...entries.filter(Boolean));
    }
    if (lines.length > 0) {
      // Bullet-style entries read better with a blank line between them.
      const sep = section.type === "skills" || lines.every((l) => !l.includes("\n")) ? "\n" : "\n\n";
      blocks.push(`${section.title.toUpperCase()}\n${lines.join(sep)}`);
    }
  }

  return blocks.filter(Boolean).join("\n\n");
}

export function coverLetterToText(coverLetter: CoverLetter): string {
  const { meta } = coverLetter;
  const subject = joinNonEmpty([meta.role.text, meta.company.text], " at ");
  return [
    meta.date.text.trim(),
    subject ? `Re: ${subject}` : "",
    coverLetter.salutation.text.trim(),
    ...coverLetter.paragraphs.map((p) => p.text.trim()),
    joinNonEmpty([coverLetter.sign_off.text, meta.name.text], "\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}
