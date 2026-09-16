"use client";

import { useState } from "react";
import { Resume } from "../types";
import { Selectable } from "./Selectable";
import {
  AddGhostRow,
  AddLinkPill,
  AddPill,
  DateRangeField,
  EditableText,
  JoinedFields,
  LinkPill,
  TextPill,
} from "./InlineEdit";

export function ResumePreview({
  resume,
  selectedIds,
  onToggle,
  mode,
  onEditField,
  onAddBullet,
  onRemoveBullet,
  onAddSkillItem,
  onRemoveSkillItem,
  onEditSkillItem,
  onAddLink,
  onRemoveLink,
  onEditLink,
}: {
  resume: Resume;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  mode: "select" | "edit";
  onEditField: (id: string, text: string) => void;
  onAddBullet: (entryId: string, text: string) => void;
  onRemoveBullet: (bulletId: string) => void;
  onAddSkillItem: (groupId: string, text: string) => void;
  onRemoveSkillItem: (groupId: string, itemId: string) => void;
  onEditSkillItem: (groupId: string, itemId: string, text: string) => void;
  onAddLink: (label: string, url: string) => void;
  onRemoveLink: (linkId: string) => void;
  onEditLink: (linkId: string, label: string, url: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const contactParts = [resume.meta.email.text, resume.meta.phone.text].filter(
    Boolean
  );
  for (const link of resume.meta.links ?? []) {
    contactParts.push(link.label ? `${link.label}: ${link.url}` : link.url);
  }

  return (
    <div
      className={`flex flex-col gap-1 rounded border bg-(--surface) p-8 text-foreground shadow-sm ${
        mode === "edit"
          ? "border-2 border-(--edit)"
          : "border border-(--border)"
      }`}
    >
      <h2 className="text-center text-xl font-bold">
        <EditableText
          id={resume.meta.name.id}
          text={resume.meta.name.text}
          onSave={onEditField}
          mode={mode}
          placeholder="Name"
        />
      </h2>

      {mode === "select" ? (
        contactParts.length > 0 && (
          <p className="text-center text-xs text-(--muted)">
            {contactParts.join(" | ")}
          </p>
        )
      ) : (
        <div className="flex flex-col items-center gap-1 text-xs text-(--muted)">
          <p className="flex flex-wrap items-center justify-center gap-x-1">
            <EditableText
              id={resume.meta.email.id}
              text={resume.meta.email.text}
              onSave={onEditField}
              mode={mode}
              placeholder="Email"
            />
            <span>|</span>
            <EditableText
              id={resume.meta.phone.id}
              text={resume.meta.phone.text}
              onSave={onEditField}
              mode={mode}
              placeholder="Phone"
            />
          </p>
          <p className="flex flex-wrap items-center justify-center gap-1">
            {(resume.meta.links ?? []).map((link) => (
              <LinkPill
                key={link.id}
                id={link.id}
                label={link.label}
                url={link.url}
                onEdit={onEditLink}
                onRemove={onRemoveLink}
              />
            ))}
            <AddLinkPill onAdd={onAddLink} />
          </p>
        </div>
      )}

      {(resume.summary.text || mode === "edit") && (
        <Selectable
          id={resume.summary.id}
          selectedIds={selectedIds}
          onToggle={onToggle}
          mode={mode}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          className="mt-2 p-1 text-sm"
        >
          <EditableText
            id={resume.summary.id}
            text={resume.summary.text}
            onSave={onEditField}
            mode={mode}
            multiline
            placeholder="Summary"
            as="p"
          />
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
            mode={mode}
            hoveredId={hoveredId}
            onHover={setHoveredId}
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
                  mode={mode}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                  className="p-1 text-sm"
                >
                  <span className="font-bold">{group.label}: </span>
                  {mode === "edit" ? (
                    <span className="mt-1 inline-flex flex-wrap gap-1 align-middle">
                      {group.items.map((item) => (
                        <TextPill
                          key={item.id}
                          id={item.id}
                          text={item.text}
                          onEdit={(id, text) => onEditSkillItem(group.id, id, text)}
                          onRemove={(id) => onRemoveSkillItem(group.id, id)}
                        />
                      ))}
                      <AddPill
                        placeholder="+ Add item"
                        onAdd={(text) => onAddSkillItem(group.id, text)}
                      />
                    </span>
                  ) : (
                    group.items.map((item) => item.text).join(", ")
                  )}
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
                  mode={mode}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                  className="p-1 text-sm"
                >
                  <JoinedFields
                    mode={mode}
                    onSave={onEditField}
                    fields={[
                      {
                        id: entry.title.id,
                        text: entry.title.text,
                        placeholder: "Title",
                      },
                      {
                        id: entry.organization.id,
                        text: entry.organization.text,
                        placeholder: "Organization",
                      },
                      {
                        id: entry.dates.id,
                        text: entry.dates.text,
                        placeholder: "Dates",
                        render: (m) => (
                          <DateRangeField
                            id={entry.dates.id}
                            text={entry.dates.text}
                            onSave={onEditField}
                            mode={m}
                          />
                        ),
                      },
                    ]}
                  />
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
                  mode={mode}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                  className="mt-1 p-1"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-bold">
                      <JoinedFields
                        mode={mode}
                        onSave={onEditField}
                        fields={[
                          {
                            id: entry.title.id,
                            text: entry.title.text,
                            placeholder: "Title",
                          },
                          {
                            id: entry.organization.id,
                            text: entry.organization.text,
                            placeholder: "Organization",
                          },
                        ]}
                      />
                    </p>
                    {(entry.dates.text || mode === "edit") && (
                      <p className="shrink-0 text-xs">
                        <DateRangeField
                          id={entry.dates.id}
                          text={entry.dates.text}
                          onSave={onEditField}
                          mode={mode}
                        />
                      </p>
                    )}
                  </div>
                  {(entry.location.text || mode === "edit") && (
                    <p className="text-xs italic text-(--muted)">
                      <EditableText
                        id={entry.location.id}
                        text={entry.location.text}
                        onSave={onEditField}
                        mode={mode}
                        placeholder="Location"
                      />
                    </p>
                  )}
                  {(entry.bullets && entry.bullets.length > 0) ||
                  mode === "edit" ? (
                    <ul className="ml-4 list-disc">
                      {entry.bullets?.map((bullet) => (
                        <Selectable
                          key={bullet.id}
                          id={bullet.id}
                          selectedIds={selectedIds}
                          onToggle={onToggle}
                          mode={mode}
                          hoveredId={hoveredId}
                          onHover={setHoveredId}
                          as="li"
                          className="group/bullet relative p-0.5 text-sm"
                        >
                          {mode === "edit" ? (
                            <span className="flex items-start justify-between gap-1">
                              <EditableText
                                id={bullet.id}
                                text={bullet.text}
                                onSave={onEditField}
                                mode={mode}
                                multiline
                                className="flex-1"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveBullet(bullet.id);
                                }}
                                aria-label="Remove bullet"
                                className="shrink-0 text-(--danger) opacity-0 transition-opacity hover:cursor-pointer group-hover/bullet:opacity-100"
                              >
                                ✕
                              </button>
                            </span>
                          ) : (
                            bullet.text
                          )}
                        </Selectable>
                      ))}
                      {mode === "edit" && (
                        <AddGhostRow
                          as="li"
                          placeholder="+ Add bullet"
                          multiline
                          onAdd={(text) => onAddBullet(entry.id, text)}
                          className="ml-0 list-none"
                        />
                      )}
                    </ul>
                  ) : null}
                </Selectable>
              ))}
          </Selectable>
        ))}
    </div>
  );
}
