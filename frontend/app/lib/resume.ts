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

    const newGroups = section.groups
      ?.map((group) => {
        if (!updateMap.has(group.id)) return group;
        const rawText = updateMap.get(group.id)!;
        if (rawText.trim().length === 0) return null;
        const items = rawText
          .split(",")
          .map((text) => text.trim())
          .filter((text) => text.length > 0)
          .map((text) => ({ id: crypto.randomUUID(), text }));
        return { ...group, items };
      })
      .filter((group) => group !== null);

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

// Removes sections, entries, bullets, skill groups, skill items and links by id, along
// with anything nested inside them. Used by the Edit-mode remove buttons and by the
// removals /revise returns. Only the document passed in changes (never the profile).
export function applyRemovals(resume: Resume, ids: string[]): Resume {
  if (ids.length === 0) return resume;
  const gone = new Set(ids);
  return {
    ...resume,
    meta: { ...resume.meta, links: resume.meta.links?.filter((l) => !gone.has(l.id)) },
    sections: resume.sections
      .filter((section) => !gone.has(section.id))
      .map((section) => ({
        ...section,
        entries: section.entries
          ?.filter((entry) => !gone.has(entry.id))
          .map((entry) =>
            !entry.bullets
              ? entry
              : { ...entry, bullets: entry.bullets.filter((b) => !gone.has(b.id)) }
          ),
        groups: section.groups
          ?.filter((group) => !gone.has(group.id))
          .map((group) => ({ ...group, items: group.items.filter((i) => !gone.has(i.id)) })),
      })),
  };
}

export function applyCoverLetterRemovals(coverLetter: CoverLetter, ids: string[]): CoverLetter {
  if (ids.length === 0) return coverLetter;
  const gone = new Set(ids);
  return { ...coverLetter, paragraphs: coverLetter.paragraphs.filter((p) => !gone.has(p.id)) };
}

// Structural equality for a resume, cover letter, or profile. The apply functions copy
// even when nothing matches, so a reference check can't tell whether anything changed.
export function sameDocument(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Every `id` anywhere in a document, for dropping selections that no longer exist.
export function collectIds(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((v) => collectIds(v, into));
  } else if (value && typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") into.add(id);
    Object.values(value).forEach((v) => collectIds(v, into));
  }
  return into;
}

export type RevisionAddition = { after: string; text: string };

// Inserts new items from /revise "additions", in order. `after` is a bullet id (insert
// right after it) or an entry id (append to its bullets); several additions after the
// same anchor keep their order.
export function applyAdditions(resume: Resume, additions: RevisionAddition[]): Resume {
  if (additions.length === 0) return resume;
  return {
    ...resume,
    sections: resume.sections.map((section) => ({
      ...section,
      entries: section.entries?.map((entry) => {
        const bullets = [...(entry.bullets ?? [])];
        let changed = false;
        // Last item inserted per anchor (by id, since positions shift as items are
        // inserted), so repeated anchors stay in order.
        const lastInserted = new Map<string, string>();
        for (const { after, text } of additions) {
          if (after === entry.id) {
            bullets.push({ id: crypto.randomUUID(), text });
            changed = true;
            continue;
          }
          const target = lastInserted.get(after) ?? after;
          const index = bullets.findIndex((b) => b.id === target);
          if (index === -1) continue;
          const bullet = { id: crypto.randomUUID(), text };
          bullets.splice(index + 1, 0, bullet);
          lastInserted.set(after, bullet.id);
          changed = true;
        }
        return changed ? { ...entry, bullets } : entry;
      }),
    })),
  };
}

export function applyCoverLetterAdditions(
  coverLetter: CoverLetter,
  additions: RevisionAddition[]
): CoverLetter {
  if (additions.length === 0) return coverLetter;
  const paragraphs = [...coverLetter.paragraphs];
  const lastInserted = new Map<string, string>();
  for (const { after, text } of additions) {
    const index = paragraphs.findIndex((p) => p.id === (lastInserted.get(after) ?? after));
    if (index === -1) continue;
    const paragraph = { id: crypto.randomUUID(), text };
    paragraphs.splice(index + 1, 0, paragraph);
    lastInserted.set(after, paragraph.id);
  }
  return { ...coverLetter, paragraphs };
}

export type SkillsReplace = { section: string; groups: { label: string; items: string[] }[] };

// Swaps in a skills section's complete new group list from /revise "skills_replace".
// Existing group ids are reused when a label matches (and item ids when text matches
// within that group); everything else gets a new id.
export function applySkillsReplace(resume: Resume, replace: SkillsReplace | null): Resume {
  if (!replace) return resume;
  const norm = (t: string) => t.trim().toLowerCase();
  return {
    ...resume,
    sections: resume.sections.map((section) => {
      if (section.id !== replace.section || section.type !== "skills") return section;
      const unused = [...(section.groups ?? [])];
      const groups = replace.groups.map(({ label, items }) => {
        const matchIndex = unused.findIndex((g) => norm(g.label) === norm(label));
        const previous = matchIndex === -1 ? null : unused.splice(matchIndex, 1)[0];
        const previousItems = [...(previous?.items ?? [])];
        return {
          id: previous?.id ?? `skill_${crypto.randomUUID()}`,
          label,
          items: items.map((text) => {
            const i = previousItems.findIndex((it) => norm(it.text) === norm(text));
            const reused = i === -1 ? null : previousItems.splice(i, 1)[0];
            return { id: reused?.id ?? crypto.randomUUID(), text };
          }),
        };
      });
      return { ...section, groups };
    }),
  };
}
