import { IdText, Profile } from "../types";

// Meta/Links and Summary Pool have no backing id of their own in the Profile
// schema (unlike a real Section), so these synthetic ids stand in for "select
// everything in this group" client-side. expandSelectedIds turns either into
// the real ids the backend actually recognizes before a /revise call goes out.
export const META_SECTION_ID = "__meta__";
export const SUMMARY_POOL_SECTION_ID = "__summary_pool__";

export function expandSelectedIds(profile: Profile, selectedIds: Set<string>): string[] {
  const result: string[] = [];
  for (const id of selectedIds) {
    if (id === META_SECTION_ID) {
      result.push(profile.meta.name.id, profile.meta.email.id, profile.meta.phone.id);
      for (const link of profile.meta.links ?? []) {
        result.push(link.id);
      }
    } else if (id === SUMMARY_POOL_SECTION_ID) {
      for (const group of profile.summary_pool) {
        result.push(group.id);
      }
    } else {
      result.push(id);
    }
  }
  return result;
}

function patchIdText(field: IdText, updateMap: Map<string, string>): IdText {
  return updateMap.has(field.id)
    ? { ...field, text: updateMap.get(field.id)! }
    : field;
}

export function applyProfileRevisionUpdates(
  profile: Profile,
  updates: { id: string; text: string }[]
): Profile {
  const updateMap = new Map(updates.map((u) => [u.id, u.text]));
  if (updateMap.size === 0) return profile;

  const newMeta = {
    ...profile.meta,
    name: patchIdText(profile.meta.name, updateMap),
    email: patchIdText(profile.meta.email, updateMap),
    phone: patchIdText(profile.meta.phone, updateMap),
    links: (profile.meta.links ?? []).map((link) =>
      updateMap.has(link.id) ? { ...link, label: updateMap.get(link.id)! } : link
    ),
  };

  const newSections = profile.sections.map((section) => {
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

  const newSummaryPool = profile.summary_pool.map((group) => ({
    ...group,
    summaries: group.summaries.map((item) =>
      updateMap.has(item.id) ? { ...item, text: updateMap.get(item.id)! } : item
    ),
  }));

  return { ...profile, meta: newMeta, sections: newSections, summary_pool: newSummaryPool };
}

export function describeProfileSelection(
  profile: Profile,
  selectedIds: Set<string>
): string {
  let bulletCount = 0;
  let entryCount = 0;
  let sectionCount = 0;
  let skillGroupCount = 0;
  let summaryItemCount = 0;
  let summaryGroupCount = 0;

  for (const group of profile.summary_pool) {
    if (selectedIds.has(group.id)) summaryGroupCount++;
    for (const item of group.summaries) {
      if (selectedIds.has(item.id)) summaryItemCount++;
    }
  }

  for (const section of profile.sections) {
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
  if (selectedIds.has(META_SECTION_ID)) {
    parts.push("Meta/Links");
  }
  if (selectedIds.has(SUMMARY_POOL_SECTION_ID)) {
    parts.push("Summary Pool");
  }
  if (summaryItemCount > 0) {
    parts.push(`${summaryItemCount} summary item${summaryItemCount === 1 ? "" : "s"}`);
  }
  if (summaryGroupCount > 0) {
    parts.push(`${summaryGroupCount} role type${summaryGroupCount === 1 ? "" : "s"}`);
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

export function addBullet(profile: Profile, entryId: string, text: string): Profile {
  return {
    ...profile,
    sections: profile.sections.map((section) => ({
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

export function removeBullet(profile: Profile, bulletId: string): Profile {
  return {
    ...profile,
    sections: profile.sections.map((section) => ({
      ...section,
      entries: section.entries?.map((entry) =>
        !entry.bullets
          ? entry
          : { ...entry, bullets: entry.bullets.filter((b) => b.id !== bulletId) }
      ),
    })),
  };
}

export function addSkillItem(profile: Profile, groupId: string, text: string): Profile {
  return {
    ...profile,
    sections: profile.sections.map((section) => ({
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
  profile: Profile,
  groupId: string,
  itemId: string
): Profile {
  return {
    ...profile,
    sections: profile.sections.map((section) => ({
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
  profile: Profile,
  groupId: string,
  itemId: string,
  text: string
): Profile {
  return {
    ...profile,
    sections: profile.sections.map((section) => ({
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

export function addLink(profile: Profile, label: string, url: string): Profile {
  return {
    ...profile,
    meta: {
      ...profile.meta,
      links: [...(profile.meta.links ?? []), { id: crypto.randomUUID(), label, url }],
    },
  };
}

export function removeLink(profile: Profile, linkId: string): Profile {
  return {
    ...profile,
    meta: {
      ...profile.meta,
      links: (profile.meta.links ?? []).filter((link) => link.id !== linkId),
    },
  };
}

export function editLink(
  profile: Profile,
  linkId: string,
  label: string,
  url: string
): Profile {
  return {
    ...profile,
    meta: {
      ...profile.meta,
      links: (profile.meta.links ?? []).map((link) =>
        link.id === linkId ? { ...link, label, url } : link
      ),
    },
  };
}

export function addSummaryItem(profile: Profile, groupId: string, text: string): Profile {
  return {
    ...profile,
    summary_pool: profile.summary_pool.map((group) =>
      group.id !== groupId
        ? group
        : { ...group, summaries: [...group.summaries, { id: crypto.randomUUID(), text }] }
    ),
  };
}

export function removeSummaryItem(
  profile: Profile,
  groupId: string,
  itemId: string
): Profile {
  return {
    ...profile,
    summary_pool: profile.summary_pool.map((group) =>
      group.id !== groupId
        ? group
        : { ...group, summaries: group.summaries.filter((item) => item.id !== itemId) }
    ),
  };
}

