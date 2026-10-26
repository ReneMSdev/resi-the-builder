"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { showToast } from "./Toast";

// Small copy-to-clipboard icon for the top-right corner of a preview. `getText` runs at
// click time, so it always copies the document as it is right now.
export function CopyButton({ getText, label }: { getText: () => string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      showToast("Copied!");
    } catch {
      showToast("Couldn't copy to the clipboard", "error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className="absolute right-2 top-2 rounded p-1.5 text-(--muted) transition-colors hover:cursor-pointer hover:bg-(--accent-soft) hover:text-foreground"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
