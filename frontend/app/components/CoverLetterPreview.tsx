"use client";

import { CoverLetter } from "../types";
import { Selectable } from "./Selectable";

export function CoverLetterPreview({
  coverLetter,
  selectedIds,
  onToggle,
}: {
  coverLetter: CoverLetter;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { meta } = coverLetter;
  const subject = [meta.role.text, meta.company.text]
    .filter(Boolean)
    .join(" at ");

  return (
    <div className="flex flex-col gap-3 rounded border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--foreground)] shadow-sm">
      {meta.date.text && (
        <p className="text-right text-xs text-[var(--muted)]">
          {meta.date.text}
        </p>
      )}

      {subject && <p className="font-bold">Re: {subject}</p>}

      <p>{coverLetter.salutation.text}</p>

      {coverLetter.paragraphs.map((paragraph) => (
        <Selectable
          key={paragraph.id}
          id={paragraph.id}
          selectedIds={selectedIds}
          onToggle={onToggle}
          className="p-1"
        >
          {paragraph.text}
        </Selectable>
      ))}

      <div className="mt-2">
        <p>{coverLetter.sign_off.text}</p>
        <p className="font-bold">{meta.name.text}</p>
        <p className="text-xs text-[var(--muted)]">
          {[meta.email.text, meta.phone.text].filter(Boolean).join(" | ")}
        </p>
      </div>
    </div>
  );
}
