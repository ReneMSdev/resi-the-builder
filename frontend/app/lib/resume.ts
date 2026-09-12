import { CoverLetter, Resume } from "../types";

export function applyRevisionUpdates(
  resume: Resume,
  updates: { id: string; text: string }[]
): Resume {
  const updateMap = new Map(updates.map((u) => [u.id, u.text]));
  if (updateMap.size === 0) return resume;

  const newSummary = updateMap.has(resume.summary.id)
    ? { ...resume.summary, text: updateMap.get(resume.summary.id)! }
    : resume.summary;

  const newSections = resume.sections.map((section) => {
    if (!section.entries) return section;
    const newEntries = section.entries.map((entry) => {
      if (!entry.bullets) return entry;
      const newBullets = entry.bullets.map((bullet) =>
        updateMap.has(bullet.id)
          ? { ...bullet, text: updateMap.get(bullet.id)! }
          : bullet
      );
      return { ...entry, bullets: newBullets };
    });
    return { ...section, entries: newEntries };
  });

  return { ...resume, summary: newSummary, sections: newSections };
}

export function describeSelection(
  resume: Resume,
  selectedIds: Set<string>
): string {
  let bulletCount = 0;
  let entryCount = 0;
  let sectionCount = 0;

  for (const section of resume.sections) {
    if (selectedIds.has(section.id)) sectionCount++;
    for (const entry of section.entries ?? []) {
      if (selectedIds.has(entry.id)) entryCount++;
      for (const bullet of entry.bullets ?? []) {
        if (selectedIds.has(bullet.id)) bulletCount++;
      }
    }
  }

  const parts: string[] = [];
  if (bulletCount > 0) {
    parts.push(`${bulletCount} bullet${bulletCount === 1 ? "" : "s"}`);
  }
  if (entryCount > 0) {
    parts.push(`${entryCount} entr${entryCount === 1 ? "y" : "ies"}`);
  }
  if (sectionCount > 0) {
    parts.push(`${sectionCount} section${sectionCount === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

export function applyCoverLetterUpdates(
  coverLetter: CoverLetter,
  updates: { id: string; text: string }[]
): CoverLetter {
  const updateMap = new Map(updates.map((u) => [u.id, u.text]));
  if (updateMap.size === 0) return coverLetter;

  const newParagraphs = coverLetter.paragraphs.map((paragraph) =>
    updateMap.has(paragraph.id)
      ? { ...paragraph, text: updateMap.get(paragraph.id)! }
      : paragraph
  );

  return { ...coverLetter, paragraphs: newParagraphs };
}

export function describeCoverLetterSelection(
  coverLetter: CoverLetter,
  selectedIds: Set<string>
): string {
  const count = coverLetter.paragraphs.filter((p) =>
    selectedIds.has(p.id)
  ).length;
  if (count === 0) return "";
  return `${count} paragraph${count === 1 ? "" : "s"}`;
}
