"use client";

import { useEffect, useState } from "react";

type BackendStatus =
  | { state: "loading" }
  | { state: "ok" }
  | { state: "error"; message: string };

type Bullet = { id: string; text: string; tags?: string[] };
type Entry = {
  id: string;
  title: string;
  organization: string;
  location?: string;
  dates?: string;
  bullets?: Bullet[];
};
type SkillGroup = { id: string; label: string; items: string[] };
type Section = {
  id: string;
  title: string;
  type: string;
  entries?: Entry[];
  groups?: SkillGroup[];
};
type Meta = {
  name: string;
  email: string;
  phone: string;
  links?: { label: string; url: string }[];
};
type Resume = {
  type: string;
  meta: Meta;
  summary: { id: string; text: string };
  sections: Section[];
};

type GenerateState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; resume: Resume }
  | { state: "error"; message: string };

export default function Home() {
  const [status, setStatus] = useState<BackendStatus>({ state: "loading" });
  const [jobDescription, setJobDescription] = useState("");
  const [companyContext, setCompanyContext] = useState("");
  const [generateState, setGenerateState] = useState<GenerateState>({
    state: "idle",
  });

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      setStatus({
        state: "error",
        message: "NEXT_PUBLIC_API_URL is not set.",
      });
      return;
    }

    fetch(`${apiUrl}/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Backend responded with status ${res.status}`);
        }
        return res.json();
      })
      .then(() => setStatus({ state: "ok" }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ state: "error", message });
      });
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setGenerateState({
        state: "error",
        message: "NEXT_PUBLIC_API_URL is not set.",
      });
      return;
    }

    setGenerateState({ state: "loading" });

    try {
      const res = await fetch(`${apiUrl}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_description: jobDescription,
          company_context: companyContext || undefined,
          type: "resume",
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body}`);
      }

      const data: { resume: Resume | null } = await res.json();
      if (!data.resume) {
        throw new Error("Response did not include a resume.");
      }

      setGenerateState({ state: "success", resume: data.resume });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setGenerateState({ state: "error", message });
    }
  }

  const isGenerating = generateState.state === "loading";

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col gap-8 py-16 px-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Resume Builder
          </h1>
          {status.state === "loading" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Checking backend...
            </p>
          )}
          {status.state === "ok" && (
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Backend: ok
            </p>
          )}
          {status.state === "error" && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Backend unreachable: {status.message}
            </p>
          )}
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-black dark:text-zinc-50">
              Job description
            </span>
            <textarea
              className="min-h-[160px] rounded border border-zinc-300 p-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-black dark:text-zinc-50">
              Company context (optional)
            </span>
            <textarea
              className="min-h-[80px] rounded border border-zinc-300 p-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              value={companyContext}
              onChange={(e) => setCompanyContext(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={isGenerating || !jobDescription.trim()}
            className="self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {isGenerating ? "Generating..." : "Generate Resume"}
          </button>
        </form>

        {generateState.state === "error" && (
          <p className="font-medium text-red-600 dark:text-red-400">
            Error generating resume: {generateState.message}
          </p>
        )}

        {generateState.state === "success" && (
          <ResumeRaw resume={generateState.resume} />
        )}
      </main>
    </div>
  );
}

function ResumeRaw({ resume }: { resume: Resume }) {
  return (
    <div className="flex flex-col gap-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <div>
        <h2 className="text-xl font-bold text-black dark:text-zinc-50">
          {resume.meta.name}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {resume.meta.email} · {resume.meta.phone}
        </p>
      </div>

      {resume.summary.text && (
        <p className="text-sm text-black dark:text-zinc-50">
          {resume.summary.text}
        </p>
      )}

      {resume.sections.map((section) => (
        <div key={section.id}>
          <h3 className="font-semibold uppercase text-black dark:text-zinc-50">
            {section.title}
          </h3>
          {section.entries?.map((entry) => (
            <div key={entry.id} className="mt-2">
              <p className="text-sm font-medium text-black dark:text-zinc-50">
                {entry.title} — {entry.organization}{" "}
                {entry.dates ? `(${entry.dates})` : ""}
              </p>
              {entry.location && (
                <p className="text-xs italic text-zinc-600 dark:text-zinc-400">
                  {entry.location}
                </p>
              )}
              {entry.bullets && entry.bullets.length > 0 && (
                <ul className="ml-5 list-disc text-sm text-black dark:text-zinc-50">
                  {entry.bullets.map((bullet) => (
                    <li key={bullet.id}>{bullet.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {section.groups?.map((group) => (
            <p key={group.id} className="mt-1 text-sm text-black dark:text-zinc-50">
              <span className="font-medium">{group.label}:</span>{" "}
              {group.items.join(", ")}
            </p>
          ))}
        </div>
      ))}

      <details className="text-xs text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer select-none">Raw JSON</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(resume, null, 2)}
        </pre>
      </details>
    </div>
  );
}
