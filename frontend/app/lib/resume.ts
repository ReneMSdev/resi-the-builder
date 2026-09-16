import { CoverLetter, IdText, Resume } from "../types";

function patchIdText(field: IdText, updateMap: Map<string, string>): IdText {
  return updateMap.has(field.id)
    ? { ...field, text: updateMap.get(field.id)! }
    : field;
}

export function applyRevisionUpdates(
  resume: Resume,
  updates: { id: string; text: string }[]
): Resume {
  const updateMap = new Map(updates.map((u) => [u.id, u.text]));
  if (updateMap.size === 0) return resume;

  const newMeta = {
    ...resume.meta,
    name: patchIdText(resume.meta.name, updateMap),
    email: patchIdText(resume.meta.email, updateMap),
    phone: patchIdText(resume.meta.phone, updateMap),
  };

  const newSummary = patchIdText(resume.summary, updateMap);

  const newSections = resume.sections.map((section) => {
    const newEntries = section.entries?.map((entry) => {
      const newBullets = entry.bullets?.map((bullet) =>
        updateMap.has(bullet.id)
          ? { ...bullet, text: updateMap.get(bullet.id)! }
          : bullet
      );
      return {
        ...entry,
        title: patchIdText(entry.title, updateMap),
        organization: patchIdText(entry.organization, updateMap),
        location: patchIdText(entry.location, updateMap),
        dates: patchIdText(entry.dates, updateMap),
        bullets: newBullets,
      };
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

  return { ...resume, meta: newMeta, summary: newSummary, sections: newSections };
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

  const newMeta = {
    ...coverLetter.meta,
    name: patchIdText(coverLetter.meta.name, updateMap),
    email: patchIdText(coverLetter.meta.email, updateMap),
    phone: patchIdText(coverLetter.meta.phone, updateMap),
    date: patchIdText(coverLetter.meta.date, updateMap),
    company: patchIdText(coverLetter.meta.company, updateMap),
    role: patchIdText(coverLetter.meta.role, updateMap),
  };

  const newParagraphs = coverLetter.paragraphs.map((paragraph) =>
    updateMap.has(paragraph.id)
      ? { ...paragraph, text: updateMap.get(paragraph.id)! }
      : paragraph
  );

  return {
    ...coverLetter,
    meta: newMeta,
    salutation: patchIdText(coverLetter.salutation, updateMap),
    sign_off: patchIdText(coverLetter.sign_off, updateMap),
    paragraphs: newParagraphs,
  };
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

export function addBullet(resume: Resume, entryId: string, text: string): Resume {
  return {
    ...resume,
    sections: resume.sections.map((section) => ({
      ...section,
      entries: section.entries?.map((entry) =>
        entry.id !== entryId
          ? entry
          : {
              ...entry,
              bullets: [...(entry.bullets ?? []), { id: crypto.randomUUID(), text }],
            }
      ),
    })),
  };
}

export function removeBullet(resume: Resume, bulletId: string): Resume {
  return {
    ...resume,
    sections: resume.sections.map((section) => ({
      ...section,
      entries: section.entries?.map((entry) =>
        !entry.bullets
          ? entry
          : { ...entry, bullets: entry.bullets.filter((b) => b.id !== bulletId) }
      ),
    })),
  };
}

export function addSkillItem(resume: Resume, groupId: string, text: string): Resume {
  return {
    ...resume,
    sections: resume.sections.map((section) => ({
      ...section,
      groups: section.groups?.map((group) =>
        group.id !== groupId
          ? group
          : { ...group, items: [...group.items, { id: crypto.randomUUID(), text }] }
      ),
    })),
  };
}

export function removeSkillItem(
  resume: Resume,
  groupId: string,
  itemId: string
): Resume {
  return {
    ...resume,
    sections: resume.sections.map((section) => ({
      ...section,
      groups: section.groups?.map((group) =>
        group.id !== groupId
          ? group
          : { ...group, items: group.items.filter((item) => item.id !== itemId) }
      ),
    })),
  };
}

export function editSkillItem(
  resume: Resume,
  groupId: string,
  itemId: string,
  text: string
): Resume {
  return {
    ...resume,
    sections: resume.sections.map((section) => ({
      ...section,
      groups: section.groups?.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              items: group.items.map((item) =>
                item.id === itemId ? { ...item, text } : item
              ),
            }
      ),
    })),
  };
}

export function addLink(resume: Resume, label: string, url: string): Resume {
  return {
    ...resume,
    meta: {
      ...resume.meta,
      links: [...(resume.meta.links ?? []), { id: crypto.randomUUID(), label, url }],
    },
  };
}

export function removeLink(resume: Resume, linkId: string): Resume {
  return {
    ...resume,
    meta: {
      ...resume.meta,
      links: (resume.meta.links ?? []).filter((link) => link.id !== linkId),
    },
  };
}

export function editLink(
  resume: Resume,
  linkId: string,
  label: string,
  url: string
): Resume {
  return {
    ...resume,
    meta: {
      ...resume.meta,
      links: (resume.meta.links ?? []).map((link) =>
        link.id === linkId ? { ...link, label, url } : link
      ),
    },
  };
}
