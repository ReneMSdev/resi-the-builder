"use client";

import { Resume } from "../types";
import { Selectable } from "./Selectable";

export function ResumePreview({
  resume,
  selectedIds,
  onToggle,
}: {
  resume: Resume;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const contactParts = [resume.meta.email, resume.meta.phone].filter(Boolean);
  for (const link of resume.meta.links ?? []) {
    contactParts.push(link.label ? `${link.label}: ${link.url}` : link.url);
  }

  return (
    <div className="flex flex-col gap-1 rounded border border-zinc-200 bg-white p-8 text-black shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
      <h2 className="text-center text-xl font-bold">{resume.meta.name}</h2>
      {contactParts.length > 0 && (
        <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
          {contactParts.join(" | ")}
        </p>
      )}

      {resume.summary.text && (
        <p className="mt-2 text-sm">{resume.summary.text}</p>
      )}

      {resume.sections
        .filter(
          (section) =>
            (section.entries && section.entries.length > 0) ||
            (section.groups && section.groups.length > 0)
        )
        .map((section) => (
          <Selectable
            key={section.id}
            id={section.id}
            selectedIds={selectedIds}
            onToggle={onToggle}
            className="mt-2 p-1"
          >
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide">
              {section.title}
            </h3>

            {section.type === "skills" &&
              section.groups?.map((group) => (
                <p key={group.id} className="text-sm">
                  <span className="font-bold">{group.label}: </span>
                  {group.items.join(", ")}
                </p>
              ))}

            {(section.type === "education" ||
              section.type === "certifications") &&
              section.entries?.map((entry) => (
                <Selectable
                  key={entry.id}
                  id={entry.id}
                  selectedIds={selectedIds}
                  onToggle={onToggle}
                  className="p-1 text-sm"
                >
                  {[entry.title, entry.organization, entry.dates]
                    .filter(Boolean)
                    .join(" — ")}
                </Selectable>
              ))}

            {section.type !== "skills" &&
              section.type !== "education" &&
              section.type !== "certifications" &&
              section.entries?.map((entry) => (
                <Selectable
                  key={entry.id}
                  id={entry.id}
                  selectedIds={selectedIds}
                  onToggle={onToggle}
                  className="mt-1 p-1"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-bold">
                      {[entry.title, entry.organization]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                    {entry.dates && (
                      <p className="shrink-0 text-xs">{entry.dates}</p>
                    )}
                  </div>
                  {entry.location && (
                    <p className="text-xs italic text-zinc-600 dark:text-zinc-400">
                      {entry.location}
                    </p>
                  )}
                  {entry.bullets && entry.bullets.length > 0 && (
                    <ul className="ml-4 list-disc">
                      {entry.bullets.map((bullet) => (
                        <Selectable
                          key={bullet.id}
                          id={bullet.id}
                          selectedIds={selectedIds}
                          onToggle={onToggle}
                          as="li"
                          className="p-0.5 text-sm"
                        >
                          {bullet.text}
                        </Selectable>
                      ))}
                    </ul>
                  )}
                </Selectable>
              ))}
          </Selectable>
        ))}
    </div>
  );
}
