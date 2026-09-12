"use client";

import { useState } from "react";

export function RevisionChat({
  selectionSummary,
  selectionCount,
  loading,
  errorMessage,
  onSubmit,
  disabledReason,
}: {
  selectionSummary: string;
  selectionCount: number;
  loading: boolean;
  errorMessage: string | null;
  onSubmit: (instruction: string) => void;
  disabledReason?: string;
}) {
  const [instruction, setInstruction] = useState("");
  const disabled = disabledReason !== undefined || selectionCount === 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || !instruction.trim() || loading) return;
    onSubmit(instruction);
    setInstruction("");
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-16 mt-4 border-t border-[var(--border)] bg-[var(--background)] px-16 py-3">
      <p className="mb-1 text-xs text-[var(--muted)]">
        {disabledReason ??
          (disabled
            ? "Select a bullet or entry above to start editing."
            : `Editing: ${selectionSummary}`)}
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={disabled}
          placeholder={
            disabledReason ??
            (disabled
              ? "Nothing selected"
              : "e.g. make this more concise, emphasize leadership...")
          }
          className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--foreground)] disabled:opacity-50"
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
