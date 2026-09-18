"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Profile } from "../types";
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

const META_ID = "__meta__";
const SUMMARY_POOL_ID = "__summary_pool__";

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
    />
  );
}

function CollapsibleHeader({
  id,
  title,
  open,
  onToggleOpen,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggleOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggleOpen(id)}
      className="flex w-full items-center gap-1 rounded p-1 text-left text-sm font-bold uppercase tracking-wide transition-colors hover:cursor-pointer hover:bg-(--accent-soft)"
    >
      <Chevron open={open} />
      {title}
    </button>
  );
}

function CollapsibleSelectableHeader({
  id,
  open,
  onToggleOpen,
  selectedIds,
  onToggle,
  mode,
  hoveredId,
  onHover,
  className = "",
  children,
}: {
  id: string;
  open: boolean;
  onToggleOpen: (id: string) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  mode: "select" | "edit";
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleOpen(id);
        }}
        aria-label={open ? "Collapse" : "Expand"}
        className="mt-1 shrink-0 hover:cursor-pointer"
      >
        <Chevron open={open} />
      </button>
      <Selectable
        id={id}
        selectedIds={selectedIds}
        onToggle={onToggle}
        mode={mode}
        hoveredId={hoveredId}
        onHover={onHover}
        className={`flex-1 ${className}`}
      >
        {children}
      </Selectable>
    </div>
  );
}

export function ProfilePreview({
  profile,
  selectedIds,
  onToggle,
  mode,
  openIds,
  onToggleOpen,
  onEditField,
  onAddBullet,
  onRemoveBullet,
  onAddSkillItem,
  onRemoveSkillItem,
  onEditSkillItem,
  onAddLink,
  onRemoveLink,
  onEditLink,
  onAddSummaryItem,
  onRemoveSummaryItem,
}: {
  profile: Profile;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  mode: "select" | "edit";
  openIds: Set<string>;
  onToggleOpen: (id: string) => void;
  onEditField: (id: string, text: string) => void;
  onAddBullet: (entryId: string, text: string) => void;
  onRemoveBullet: (bulletId: string) => void;
  onAddSkillItem: (groupId: string, text: string) => void;
  onRemoveSkillItem: (groupId: string, itemId: string) => void;
  onEditSkillItem: (groupId: string, itemId: string, text: string) => void;
  onAddLink: (label: string, url: string) => void;
  onRemoveLink: (linkId: string) => void;
  onEditLink: (linkId: string, label: string, url: string) => void;
  onAddSummaryItem: (groupId: string, text: string) => void;
  onRemoveSummaryItem: (groupId: string, itemId: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div
      className={`flex flex-col gap-1 rounded border bg-(--surface) p-8 text-foreground shadow-sm ${
        mode === "edit" ? "border-2 border-(--edit)" : "border border-(--border)"
      }`}
    >
      {/* Meta / Links */}
      <CollapsibleHeader
        id={META_ID}
        title="Meta / Links"
        open={openIds.has(META_ID)}
        onToggleOpen={onToggleOpen}
      />
      {openIds.has(META_ID) && (
        <div className="flex flex-col gap-2 py-2 pl-5">
          <Selectable
            id={profile.meta.name.id}
            selectedIds={selectedIds}
            onToggle={onToggle}
            mode={mode}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            className="p-1 text-lg font-bold"
          >
            <EditableText
              id={profile.meta.name.id}
              text={profile.meta.name.text}
              onSave={onEditField}
              mode={mode}
              placeholder="Name"
            />
          </Selectable>
          <div className="flex flex-wrap items-center gap-1 text-xs text-(--muted)">
            <Selectable
              id={profile.meta.email.id}
              selectedIds={selectedIds}
              onToggle={onToggle}
              mode={mode}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              className="p-1"
            >
              <EditableText
                id={profile.meta.email.id}
                text={profile.meta.email.text}
                onSave={onEditField}
                mode={mode}
                placeholder="Email"
              />
            </Selectable>
            <span>|</span>
            <Selectable
              id={profile.meta.phone.id}
              selectedIds={selectedIds}
              onToggle={onToggle}
              mode={mode}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              className="p-1"
            >
              <EditableText
                id={profile.meta.phone.id}
                text={profile.meta.phone.text}
                onSave={onEditField}
                mode={mode}
                placeholder="Phone"
              />
            </Selectable>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {(profile.meta.links ?? []).map((link) => (
              <Selectable
                key={link.id}
                id={link.id}
                selectedIds={selectedIds}
                onToggle={onToggle}
                mode={mode}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                className="p-0"
              >
                <LinkPill
                  id={link.id}
                  label={link.label}
                  url={link.url}
                  onEdit={onEditLink}
                  onRemove={onRemoveLink}
                />
              </Selectable>
            ))}
            {mode === "edit" && <AddLinkPill onAdd={onAddLink} />}
          </div>
        </div>
      )}

      {/* Summary Pool */}
      <CollapsibleHeader
        id={SUMMARY_POOL_ID}
        title="Summary Pool"
        open={openIds.has(SUMMARY_POOL_ID)}
        onToggleOpen={onToggleOpen}
      />
      {openIds.has(SUMMARY_POOL_ID) && (
        <div className="flex flex-col gap-1 py-2 pl-5">
          {profile.summary_pool.map((group) => (
            <div
              key={group.id}
              className="flex flex-col gap-1"
            >
              <CollapsibleSelectableHeader
                id={group.id}
                open={openIds.has(group.id)}
                onToggleOpen={onToggleOpen}
                selectedIds={selectedIds}
                onToggle={onToggle}
                mode={mode}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                className="text-sm font-bold"
              >
                {group.role_type}
              </CollapsibleSelectableHeader>
              {openIds.has(group.id) && (
                <div className="flex flex-col gap-2 pl-5">
                  {group.summaries.map((item) => (
                    <Selectable
                      key={item.id}
                      id={item.id}
                      selectedIds={selectedIds}
                      onToggle={onToggle}
                      mode={mode}
                      hoveredId={hoveredId}
                      onHover={setHoveredId}
                      className="p-1 text-sm"
                    >
                      <span className="flex items-start justify-between gap-1">
                        <EditableText
                          id={item.id}
                          text={item.text}
                          onSave={onEditField}
                          mode={mode}
                          multiline
                          className="flex-1"
                        />
                        {mode === "edit" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSummaryItem(group.id, item.id);
                            }}
                            aria-label="Remove summary item"
                            className="shrink-0 text-(--danger) hover:cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    </Selectable>
                  ))}
                  {mode === "edit" && (
                    <AddGhostRow
                      placeholder="+ Add phrasing"
                      multiline
                      onAdd={(text) => onAddSummaryItem(group.id, text)}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sections: Experience, Projects, Education, Certifications, Skills */}
      {profile.sections
        .filter(
          (section) =>
            (section.entries && section.entries.length > 0) ||
            (section.groups && section.groups.length > 0)
        )
        .map((section) => (
          <div key={section.id}>
            <CollapsibleSelectableHeader
              id={section.id}
              open={openIds.has(section.id)}
              onToggleOpen={onToggleOpen}
              selectedIds={selectedIds}
              onToggle={onToggle}
              mode={mode}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              className="text-sm font-bold uppercase tracking-wide"
            >
              {section.title}
            </CollapsibleSelectableHeader>

            {openIds.has(section.id) && (
              <div className="flex flex-col gap-1 pl-5">
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

                {(section.type === "education" || section.type === "certifications") &&
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
                          { id: entry.title.id, text: entry.title.text, placeholder: "Title" },
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
                    <div key={entry.id}>
                      <CollapsibleSelectableHeader
                        id={entry.id}
                        open={openIds.has(entry.id)}
                        onToggleOpen={onToggleOpen}
                        selectedIds={selectedIds}
                        onToggle={onToggle}
                        mode={mode}
                        hoveredId={hoveredId}
                        onHover={setHoveredId}
                        className="text-sm"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-bold">
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
                      </CollapsibleSelectableHeader>

                      {openIds.has(entry.id) && (
                        <div className="pl-5">
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
                          {(entry.bullets && entry.bullets.length > 0) || mode === "edit" ? (
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
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
