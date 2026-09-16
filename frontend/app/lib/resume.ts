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
    const newEntries = section.entries?.map((entry) => {
      if (!entry.bullets) return entry;
      const newBullets = entry.bullets.map((bullet) =>
        updateMap.has(bullet.id)
          ? { ...bullet, text: updateMap.get(bullet.id)! }
          : bullet
      );
      return { ...entry, bullets: newBullets };
    });

    const newGroups = section.groups?.map((group) => {
      if (!updateMap.has(group.id)) return group;
      const items = updateMap
        .get(group.id)!
        .split(",")
        .map((text) => text.trim())
        .filter((text) => text.length > 0)
        .map((text) => ({ id: crypto.randomUUID(), text }));
      return { ...group, items };
    });

    return { ...section, entries: newEntries, groups: newGroups };
  });

  return { ...resume, summary: newSummary, sections: newSections };
}

export function describeSelection(
  resume: Resume,
  selectedIds: Set<string>
): string {
  let summaryCount = 0;
  let bulletCount = 0;
  let entryCount = 0;
  let sectionCount = 0;
  let skillGroupCount = 0;

  if (selectedIds.has(resume.summary.id)) summaryCount++;

  for (const section of resume.sections) {
    if (selectedIds.has(section.id)) sectionCount++;
    for (const entry of section.entries ?? []) {
      if (selectedIds.has(entry.id)) entryCount++;
      for (const bullet of entry.bullets ?? []) {
        if (selectedIds.has(bullet.id)) bulletCount++;
      }
    }
    for (const group of section.groups ?? []) {
      if (selectedIds.has(group.id)) skillGroupCount++;
    }
  }

  const parts: string[] = [];
  if (summaryCount > 0) {
    parts.push(`${summaryCount} summary`);
  }
  if (bulletCount > 0) {
    parts.push(`${bulletCount} bullet${bulletCount === 1 ? "" : "s"}`);
  }
  if (entryCount > 0) {
    parts.push(`${entryCount} entr${entryCount === 1 ? "y" : "ies"}`);
  }
  if (skillGroupCount > 0) {
    parts.push(`${skillGroupCount} skill group${skillGroupCount === 1 ? "" : "s"}`);
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
