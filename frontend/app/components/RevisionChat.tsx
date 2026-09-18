"use client";

import { useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";

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
  canRevert,
  onRevert,
  demoMode = false,
  demoPillAvailable = false,
  onApplyDemoRefinement,
}: {
  selectionSummary: string;
  selectionCount: number;
  loading: boolean;
  errorMessage: string | null;
  onSubmit: (instruction: string) => void;
  canRevert: boolean;
  onRevert: () => void;
  demoMode?: boolean;
  demoPillAvailable?: boolean;
  onApplyDemoRefinement?: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const nothingSelected = selectionCount === 0;
  // In demo mode the free-text input/button are inert — the suggested-edit
  // pill below is the only trigger — kept visible rather than removed so the
  // layout still matches the real app.
  const disabled = demoMode || nothingSelected;
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
      {demoMode && (
        <div className="mb-2 rounded border border-[var(--success)] bg-[var(--success)]/10 px-3 py-2 text-xs text-[var(--success)]">
          Demo mode: this uses pre-scripted edits, not a live AI — select an
          item, then click its suggested edit to see it applied.
        </div>
      )}
      <p className="mb-1 text-xs text-[var(--muted)]">
        {nothingSelected
          ? "Select an item above to start editing."
          : `Editing: ${selectionSummary}`}
      </p>
      {demoMode && !nothingSelected && (
        <div className="mb-2">
          {demoPillAvailable ? (
            <button
              type="button"
              onClick={onApplyDemoRefinement}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)] transition-colors hover:cursor-pointer hover:bg-[var(--accent)] hover:text-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Applying..." : "✨ Apply suggested edit"}
            </button>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              No suggested edit for this selection.
            </p>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            demoMode
              ? "Free text is disabled in this demo — use the suggested edit above."
              : disabled
                ? "Nothing selected"
                : "e.g. make this more concise, emphasize leadership..."
          }
          className="max-h-[50vh] flex-1 resize-none overflow-y-auto rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--foreground)] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onRevert}
          disabled={!canRevert}
          title="Revert last change"
          aria-label="Revert last change"
          className="rounded border border-[var(--border)] p-2 text-[var(--foreground)] transition-colors hover:cursor-pointer hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" />
        </button>
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
