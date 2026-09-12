import { Resume } from "../types";

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

  for (const section of resume.sections) {
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
  return parts.join(", ");
}
