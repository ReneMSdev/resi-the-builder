"use client";

import { useEffect, useRef, useState } from "react";

function autoResize(el: HTMLTextAreaElement) {
  const { borderTopWidth, borderBottomWidth } = getComputedStyle(el);
  const border = parseFloat(borderTopWidth) + parseFloat(borderBottomWidth);
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + border}px`;
}

export function RevisionChat({
  selectionSummary,
  selectionCount,
  loading,
  errorMessage,
  onSubmit,
}: {
  selectionSummary: string;
  selectionCount: number;
  loading: boolean;
  errorMessage: string | null;
  onSubmit: (instruction: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const disabled = selectionCount === 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current);
  }, [instruction]);

  function submitInstruction() {
    if (disabled || !instruction.trim() || loading) return;
    onSubmit(instruction);
    setInstruction("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitInstruction();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitInstruction();
    }
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-16 mt-4 border-t border-[var(--border)] bg-[var(--background)] px-16 py-3">
      <p className="mb-1 text-xs text-[var(--muted)]">
        {disabled
          ? "Select an item above to start editing."
          : `Editing: ${selectionSummary}`}
      </p>
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            disabled
              ? "Nothing selected"
              : "e.g. make this more concise, emphasize leadership..."
          }
          className="max-h-[50vh] flex-1 resize-none overflow-y-auto rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--foreground)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || loading || !instruction.trim()}
          className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--surface)] transition-colors hover:cursor-pointer hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {loading ? "Revising..." : "Revise"}
        </button>
      </form>
      {errorMessage && (
        <p className="mt-1 text-xs font-medium text-[var(--danger)]">
          Error revising: {errorMessage}
        </p>
      )}
    </div>
  );
}
