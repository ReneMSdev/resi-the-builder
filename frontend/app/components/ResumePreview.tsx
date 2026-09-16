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
  const contactParts = [resume.meta.email.text, resume.meta.phone.text].filter(
    Boolean
  );
  for (const link of resume.meta.links ?? []) {
    contactParts.push(link.label ? `${link.label}: ${link.url}` : link.url);
  }

  return (
    <div className="flex flex-col gap-1 rounded border border-[var(--border)] bg-[var(--surface)] p-8 text-[var(--foreground)] shadow-sm">
      <h2 className="text-center text-xl font-bold">{resume.meta.name.text}</h2>
      {contactParts.length > 0 && (
        <p className="text-center text-xs text-[var(--muted)]">
          {contactParts.join(" | ")}
        </p>
      )}

      {resume.summary.text && (
        <Selectable
          id={resume.summary.id}
          selectedIds={selectedIds}
          onToggle={onToggle}
          className="mt-2 p-1 text-sm"
        >
          {resume.summary.text}
        </Selectable>
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
                <Selectable
                  key={group.id}
                  id={group.id}
                  selectedIds={selectedIds}
                  onToggle={onToggle}
                  className="p-1 text-sm"
                >
                  <span className="font-bold">{group.label}: </span>
                  {group.items.map((item) => item.text).join(", ")}
                </Selectable>
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
                  {[entry.title.text, entry.organization.text, entry.dates.text]
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
                      {[entry.title.text, entry.organization.text]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                    {entry.dates.text && (
                      <p className="shrink-0 text-xs">{entry.dates.text}</p>
                    )}
                  </div>
                  {entry.location.text && (
                    <p className="text-xs italic text-[var(--muted)]">
                      {entry.location.text}
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
