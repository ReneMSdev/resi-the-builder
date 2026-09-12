"use client";

import { useState } from "react";
import { Resume } from "../types";

type DownloadState =
  | { state: "idle" }
  | { state: "loading"; format: "docx" | "pdf" }
  | { state: "error"; message: string };

export function DownloadButtons({ resume }: { resume: Resume }) {
  const [downloadState, setDownloadState] = useState<DownloadState>({
    state: "idle",
  });

  async function handleDownload(format: "docx" | "pdf") {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setDownloadState({
        state: "error",
        message: "NEXT_PUBLIC_API_URL is not set.",
      });
      return;
    }

    setDownloadState({ state: "loading", format });

    try {
      const res = await fetch(`${apiUrl}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, format }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body}`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `resume.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDownloadState({ state: "idle" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setDownloadState({ state: "error", message });
    }
  }

  const isLoading = downloadState.state === "loading";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleDownload("docx")}
          disabled={isLoading}
          className="rounded border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:cursor-pointer hover:bg-[var(--accent-soft)] disabled:opacity-50"
        >
          {downloadState.state === "loading" && downloadState.format === "docx"
            ? "Downloading..."
            : "Download .docx"}
        </button>
        <button
          type="button"
          onClick={() => handleDownload("pdf")}
          disabled={isLoading}
          className="rounded border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:cursor-pointer hover:bg-[var(--accent-soft)] disabled:opacity-50"
        >
          {downloadState.state === "loading" && downloadState.format === "pdf"
            ? "Downloading..."
            : "Download .pdf"}
        </button>
      </div>
      {downloadState.state === "error" && (
        <p className="text-xs font-medium text-[var(--danger)]">
          Error downloading: {downloadState.message}
        </p>
      )}
    </div>
  );
}
