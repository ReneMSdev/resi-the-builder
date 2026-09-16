"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "select" | "edit";

function handleEditKeyDown(
  e: React.KeyboardEvent,
  multiline: boolean,
  commit: () => void,
  cancel: () => void
) {
  if (e.key === "Escape") {
    e.preventDefault();
    cancel();
  } else if (e.key === "Enter" && !(multiline && e.shiftKey)) {
    e.preventDefault();
    commit();
  }
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function EditableText({
  id,
  text,
  onSave,
  mode,
  multiline = false,
  as: Tag = "span",
  className = "",
  placeholder,
}: {
  id: string;
  text: string;
  onSave: (id: string, text: string) => void;
  mode: Mode;
  multiline?: boolean;
  as?: "span" | "p" | "div";
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const inputRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      if (multiline) autoResize(inputRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== text) onSave(id, draft);
  }

  function cancel() {
    setDraft(text);
    setEditing(false);
  }

  if (editing) {
    const shared = {
      value: draft,
      onKeyDown: (e: React.KeyboardEvent) =>
        handleEditKeyDown(e, multiline, commit, cancel),
      onBlur: commit,
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      placeholder,
      className: `rounded border border-(--edit) bg-(--surface) px-1 outline-none ${className}`,
    };
    return multiline ? (
      <textarea
        ref={inputRef}
        rows={1}
        {...shared}
        onChange={(e) => {
          setDraft(e.target.value);
          autoResize(e.target);
        }}
        className={`${shared.className} block w-full resize-none`}
      />
    ) : (
      <input
        ref={inputRef}
        type="text"
        {...shared}
        onChange={(e) => setDraft(e.target.value)}
        className={`${shared.className} inline-block w-full`}
      />
    );
  }

  if (mode !== "edit") {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag
      className={`cursor-text rounded px-0.5 hover:bg-(--edit-soft) ${className}`}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        setDraft(text);
        setEditing(true);
      }}
    >
      {text || (
        <span className="italic text-(--muted)">
          {placeholder ?? "click to edit"}
        </span>
      )}
    </Tag>
  );
}

export function JoinedFields({
  fields,
  mode,
  onSave,
  sep = " — ",
}: {
  fields: { id: string; text: string; placeholder: string }[];
  mode: Mode;
  onSave: (id: string, text: string) => void;
  sep?: string;
}) {
  const visible = fields.filter((f) => f.text || mode === "edit");
  return (
    <>
      {visible.map((f, i) => (
        <span key={f.id}>
          {i > 0 && sep}
          <EditableText
            id={f.id}
            text={f.text}
            onSave={onSave}
            mode={mode}
            placeholder={f.placeholder}
          />
        </span>
      ))}
    </>
  );
}

function InlineNewInput({
  multiline = false,
  placeholder,
  onCommit,
  onCancel,
  className = "",
}: {
  multiline?: boolean;
  placeholder?: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function commit() {
    const trimmed = value.trim();
    if (trimmed) onCommit(trimmed);
    else onCancel();
  }

  const shared = {
    value,
    onKeyDown: (e: React.KeyboardEvent) =>
      handleEditKeyDown(e, multiline, commit, onCancel),
    onBlur: commit,
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    placeholder,
    className: `rounded border border-(--edit) bg-(--surface) px-1 text-sm outline-none ${className}`,
  };

  return multiline ? (
    <textarea
      ref={ref}
      rows={1}
      {...shared}
      onChange={(e) => {
        setValue(e.target.value);
        autoResize(e.target);
      }}
      className={`${shared.className} block w-full resize-none`}
    />
  ) : (
    <input ref={ref} type="text" {...shared} onChange={(e) => setValue(e.target.value)} />
  );
}

export function AddGhostRow({
  placeholder,
  multiline = false,
  onAdd,
  as = "div",
  className = "",
}: {
  placeholder: string;
  multiline?: boolean;
  onAdd: (text: string) => void;
  as?: "div" | "li";
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const Tag = as;

  if (active) {
    return (
      <Tag className={className}>
        <InlineNewInput
          multiline={multiline}
          onCommit={(text) => {
            onAdd(text);
            setActive(false);
          }}
          onCancel={() => setActive(false)}
        />
      </Tag>
    );
  }

  return (
    <Tag
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        setActive(true);
      }}
      className={`cursor-pointer rounded border border-dashed border-(--muted) px-2 py-0.5 text-xs text-(--muted) hover:bg-(--edit-soft) ${className}`}
    >
      {placeholder}
    </Tag>
  );
}

export function TextPill({
  id,
  text,
  onEdit,
  onRemove,
}: {
  id: string;
  text: string;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft !== text) onEdit(id, draft.trim());
    else setDraft(text);
  }

  function cancel() {
    setDraft(text);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => handleEditKeyDown(e, false, commit, cancel)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        className="rounded-full border border-(--edit) bg-(--surface) px-2 py-0.5 text-xs outline-none"
      />
    );
  }

  return (
    <span className="group relative inline-flex items-center gap-1 rounded-full bg-(--edit-soft) px-2 py-0.5 text-xs">
      <span
        className="cursor-text"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(text);
          setEditing(true);
        }}
      >
        {text}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
        aria-label="Remove"
        className="text-(--danger) opacity-0 transition-opacity hover:cursor-pointer group-hover:opacity-100"
      >
        ✕
      </button>
    </span>
  );
}

export function AddPill({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (text: string) => void;
}) {
  return (
    <AddGhostRow
      placeholder={placeholder}
      onAdd={onAdd}
      className="rounded-full border-dashed! px-2! py-0.5! text-xs"
    />
  );
}

function linkKeyDown(
  e: React.KeyboardEvent,
  commit: () => void,
  cancel: () => void
) {
  if (e.key === "Escape") {
    e.preventDefault();
    cancel();
  } else if (e.key === "Enter") {
    e.preventDefault();
    commit();
  }
}

export function LinkPill({
  id,
  label,
  url,
  onEdit,
  onRemove,
}: {
  id: string;
  label: string;
  url: string;
  onEdit: (id: string, label: string, url: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const [draftUrl, setDraftUrl] = useState(url);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draftUrl.trim()) onEdit(id, draftLabel.trim(), draftUrl.trim());
    else {
      setDraftLabel(label);
      setDraftUrl(url);
    }
  }

  function cancel() {
    setDraftLabel(label);
    setDraftUrl(url);
    setEditing(false);
  }

  if (editing) {
    return (
      <span
        className="inline-flex flex-col gap-0.5 rounded border border-(--edit) bg-(--surface) p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={ref}
          type="text"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => linkKeyDown(e, commit, cancel)}
          placeholder="Label"
          className="rounded border border-(--border) px-1 text-xs outline-none"
        />
        <input
          type="text"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onKeyDown={(e) => linkKeyDown(e, commit, cancel)}
          onBlur={commit}
          placeholder="URL"
          className="rounded border border-(--border) px-1 text-xs outline-none"
        />
      </span>
    );
  }

  return (
    <span className="group relative inline-flex items-center gap-1 rounded-full bg-(--edit-soft) px-2 py-0.5 text-xs">
      <span
        className="cursor-text"
        onClick={(e) => {
          e.stopPropagation();
          setDraftLabel(label);
          setDraftUrl(url);
          setEditing(true);
        }}
      >
        {label ? `${label}: ${url}` : url}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
        aria-label="Remove link"
        className="text-(--danger) opacity-0 transition-opacity hover:cursor-pointer group-hover:opacity-100"
      >
        ✕
      </button>
    </span>
  );
}

export function AddLinkPill({
  onAdd,
}: {
  onAdd: (label: string, url: string) => void;
}) {
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) ref.current?.focus();
  }, [active]);

  function reset() {
    setActive(false);
    setLabel("");
    setUrl("");
  }

  function commit() {
    if (url.trim()) onAdd(label.trim(), url.trim());
    reset();
  }

  if (!active) {
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          setActive(true);
        }}
        className="cursor-pointer rounded-full border border-dashed border-(--muted) px-2 py-0.5 text-xs text-(--muted) hover:bg-(--edit-soft)"
      >
        + Add link
      </span>
    );
  }

  return (
    <span
      className="inline-flex flex-col gap-0.5 rounded border border-(--edit) bg-(--surface) p-1"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => linkKeyDown(e, commit, reset)}
        placeholder="Label"
        className="rounded border border-(--border) px-1 text-xs outline-none"
      />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => linkKeyDown(e, commit, reset)}
        onBlur={commit}
        placeholder="URL"
        className="rounded border border-(--border) px-1 text-xs outline-none"
      />
    </span>
  );
}
