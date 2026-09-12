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
  const subject = [meta.role, meta.company].filter(Boolean).join(" at ");

  return (
    <div className="flex flex-col gap-3 rounded border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--foreground)] shadow-sm">
      {meta.date && (
        <p className="text-right text-xs text-[var(--muted)]">{meta.date}</p>
      )}

      {subject && <p className="font-bold">Re: {subject}</p>}

      <p>Dear Hiring Manager,</p>

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
        <p>Sincerely,</p>
        <p className="font-bold">{meta.name}</p>
        <p className="text-xs text-[var(--muted)]">
          {[meta.email, meta.phone].filter(Boolean).join(" | ")}
        </p>
      </div>
    </div>
  );
}
