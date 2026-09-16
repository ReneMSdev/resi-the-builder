"use client";

import { useState } from "react";
import { CoverLetter } from "../types";
import { Selectable } from "./Selectable";
import { EditableText, JoinedFields } from "./InlineEdit";

export function CoverLetterPreview({
  coverLetter,
  selectedIds,
  onToggle,
  mode,
  onEditField,
}: {
  coverLetter: CoverLetter;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  mode: "select" | "edit";
  onEditField: (id: string, text: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { meta } = coverLetter;
  const subject = [meta.role.text, meta.company.text]
    .filter(Boolean)
    .join(" at ");

  return (
    <div
      className={`flex flex-col gap-3 rounded bg-(--surface) p-8 text-sm text-foreground shadow-sm ${
        mode === "edit"
          ? "border-2 border-(--edit)"
          : "border border-(--border)"
      }`}
    >
      {(meta.date.text || mode === "edit") && (
        <p className="text-right text-xs text-(--muted)">
          <EditableText
            id={meta.date.id}
            text={meta.date.text}
            onSave={onEditField}
            mode={mode}
            placeholder="Date"
          />
        </p>
      )}

      {(subject || mode === "edit") && (
        <p className="font-bold">
          Re:{" "}
          <JoinedFields
            mode={mode}
            onSave={onEditField}
            sep=" at "
            fields={[
              { id: meta.role.id, text: meta.role.text, placeholder: "Role" },
              {
                id: meta.company.id,
                text: meta.company.text,
                placeholder: "Company",
              },
            ]}
          />
        </p>
      )}

      <p>
        <EditableText
          id={coverLetter.salutation.id}
          text={coverLetter.salutation.text}
          onSave={onEditField}
          mode={mode}
          placeholder="Dear Hiring Manager,"
        />
      </p>

      {coverLetter.paragraphs.map((paragraph) => (
        <Selectable
          key={paragraph.id}
          id={paragraph.id}
          selectedIds={selectedIds}
          onToggle={onToggle}
          mode={mode}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          className="p-1"
        >
          <EditableText
            id={paragraph.id}
            text={paragraph.text}
            onSave={onEditField}
            mode={mode}
            multiline
            as="p"
          />
        </Selectable>
      ))}

      <div className="mt-2">
        <p>
          <EditableText
            id={coverLetter.sign_off.id}
            text={coverLetter.sign_off.text}
            onSave={onEditField}
            mode={mode}
            placeholder="Sincerely,"
          />
        </p>
        <p className="font-bold">
          <EditableText
            id={meta.name.id}
            text={meta.name.text}
            onSave={onEditField}
            mode={mode}
            placeholder="Name"
          />
        </p>
        <p className="text-xs text-(--muted)">
          <JoinedFields
            mode={mode}
            onSave={onEditField}
            sep=" | "
            fields={[
              { id: meta.email.id, text: meta.email.text, placeholder: "Email" },
              { id: meta.phone.id, text: meta.phone.text, placeholder: "Phone" },
            ]}
          />
        </p>
      </div>
    </div>
  );
}
