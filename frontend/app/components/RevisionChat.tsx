"use client";

import { useState } from "react";

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || !instruction.trim() || loading) return;
    onSubmit(instruction);
    setInstruction("");
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-16 mt-4 border-t border-zinc-200 bg-zinc-50 px-16 py-3 dark:border-zinc-800 dark:bg-black">
      <p className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">
        {disabled
          ? "Select a bullet or entry above to start editing."
          : `Editing: ${selectionSummary}`}
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={disabled}
          placeholder={
            disabled
              ? "Nothing selected"
              : "e.g. make this more concise, emphasize leadership..."
          }
          className="flex-1 rounded border border-zinc-300 p-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={disabled || loading || !instruction.trim()}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Revising..." : "Revise"}
        </button>
      </form>
      {errorMessage && (
        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
          Error revising: {errorMessage}
        </p>
      )}
    </div>
  );
}
