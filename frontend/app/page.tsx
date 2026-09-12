'use client'

import { useEffect, useState } from 'react'
import { CoverLetter, Resume } from './types'
import { ResumePreview } from './components/ResumePreview'
import { CoverLetterPreview } from './components/CoverLetterPreview'
import { RevisionChat } from './components/RevisionChat'
import { DownloadButtons } from './components/DownloadButtons'
import { applyRevisionUpdates, describeSelection } from './lib/resume'

type BackendStatus = { state: 'loading' } | { state: 'ok' } | { state: 'error'; message: string }

type Mode = 'resume' | 'cover_letter'

type GenerateState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success'; kind: 'resume'; resume: Resume }
  | { state: 'success'; kind: 'cover_letter'; coverLetter: CoverLetter }
  | { state: 'error'; message: string }

type ReviseState = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string }

export default function Home() {
  const [status, setStatus] = useState<BackendStatus>(() =>
    process.env.NEXT_PUBLIC_API_URL
      ? { state: 'loading' }
      : { state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' },
  )
  const [mode, setMode] = useState<Mode>('resume')
  const [jobDescription, setJobDescription] = useState('')
  const [companyContext, setCompanyContext] = useState('')
  const [generateState, setGenerateState] = useState<GenerateState>({
    state: 'idle',
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reviseState, setReviseState] = useState<ReviseState>({
    state: 'idle',
  })

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) return

    fetch(`${apiUrl}/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Backend responded with status ${res.status}`)
        }
        return res.json()
      })
      .then(() => setStatus({ state: 'ok' }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setStatus({ state: 'error', message })
      })
  }, [])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()

    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      setGenerateState({
        state: 'error',
        message: 'NEXT_PUBLIC_API_URL is not set.',
      })
      return
    }

    setGenerateState({ state: 'loading' })
    setSelectedIds(new Set())

    try {
      const res = await fetch(`${apiUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_description: jobDescription,
          company_context: companyContext || undefined,
          type: mode,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      const data: { resume: Resume | null; cover_letter: CoverLetter | null } = await res.json()

      if (mode === 'resume') {
        if (!data.resume) {
          throw new Error('Response did not include a resume.')
        }
        setGenerateState({ state: 'success', kind: 'resume', resume: data.resume })
      } else {
        if (!data.cover_letter) {
          throw new Error('Response did not include a cover letter.')
        }
        setGenerateState({ state: 'success', kind: 'cover_letter', coverLetter: data.cover_letter })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setGenerateState({ state: 'error', message })
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleRevise(instruction: string) {
    if (generateState.state !== 'success' || generateState.kind !== 'resume') return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      setReviseState({
        state: 'error',
        message: 'NEXT_PUBLIC_API_URL is not set.',
      })
      return
    }

    setReviseState({ state: 'loading' })

    try {
      const res = await fetch(`${apiUrl}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_ids: Array.from(selectedIds),
          instruction,
          resume: generateState.resume,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      const data: { updates: { id: string; text: string }[] } = await res.json()

      setGenerateState((prev) =>
        prev.state === 'success' && prev.kind === 'resume'
          ? {
              state: 'success',
              kind: 'resume',
              resume: applyRevisionUpdates(prev.resume, data.updates),
            }
          : prev,
      )
      setReviseState({ state: 'idle' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setReviseState({ state: 'error', message })
    }
  }

  function handleModeChange(newMode: Mode) {
    if (newMode === mode) return
    setMode(newMode)
    setGenerateState({ state: 'idle' })
    setSelectedIds(new Set())
  }

  const isGenerating = generateState.state === 'loading'

  const tabClass = (tab: Mode) =>
    `rounded px-3 py-1.5 text-sm font-medium transition-colors hover:cursor-pointer ${
      mode === tab
        ? 'bg-[var(--accent)] text-[var(--surface)]'
        : 'border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent-soft)]'
    }`

  return (
    <div className='flex flex-col flex-1 items-center bg-[var(--background)] font-sans'>
      <main className='flex flex-1 w-full max-w-3xl flex-col gap-8 py-16 px-16'>
        <div className='flex flex-col items-center gap-2'>
          <h1 className='text-2xl font-semibold text-[var(--foreground)]'>Resume Builder</h1>
          {status.state === 'loading' && (
            <p className='text-sm text-[var(--muted)]'>Checking backend...</p>
          )}
          {status.state === 'ok' && (
            <p className='text-sm font-medium text-[var(--success)]'>Backend: ok</p>
          )}
          {status.state === 'error' && (
            <p className='text-sm font-medium text-[var(--danger)]'>
              Backend unreachable: {status.message}
            </p>
          )}
        </div>

        <div className='flex gap-2 self-center'>
          <button
            type='button'
            onClick={() => handleModeChange('resume')}
            className={tabClass('resume')}
          >
            Resume
          </button>
          <button
            type='button'
            onClick={() => handleModeChange('cover_letter')}
            className={tabClass('cover_letter')}
          >
            Cover Letter
          </button>
        </div>

        <form
          onSubmit={handleGenerate}
          className='flex flex-col gap-4'
        >
          <label className='flex flex-col gap-1'>
            <span className='text-sm font-medium text-[var(--foreground)]'>Job description</span>
            <textarea
              className='min-h-[160px] rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--foreground)]'
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              required
            />
          </label>
          <label className='flex flex-col gap-1'>
            <span className='text-sm font-medium text-[var(--foreground)]'>
              Company context (optional)
            </span>
            <textarea
              className='min-h-[80px] rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--foreground)]'
              value={companyContext}
              onChange={(e) => setCompanyContext(e.target.value)}
            />
          </label>
          <button
            type='submit'
            disabled={isGenerating || !jobDescription.trim()}
            className='self-start rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--surface)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 hover:cursor-pointer'
          >
            {isGenerating
              ? 'Generating...'
              : mode === 'resume'
                ? 'Generate Resume'
                : 'Generate Cover Letter'}
          </button>
        </form>

        {generateState.state === 'error' && (
          <p className='font-medium text-[var(--danger)]'>
            Error generating {mode === 'resume' ? 'resume' : 'cover letter'}: {generateState.message}
          </p>
        )}

        {generateState.state === 'success' && generateState.kind === 'resume' && (
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-xs text-[var(--muted)]'>
                {selectedIds.size === 0
                  ? 'Click a bullet or entry to select it.'
                  : `Selected: ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`}
              </p>
              <DownloadButtons resume={generateState.resume} />
            </div>
            <ResumePreview
              resume={generateState.resume}
              selectedIds={selectedIds}
              onToggle={toggleSelected}
            />
            <details className='text-xs text-[var(--muted)]'>
              <summary className='cursor-pointer select-none'>Raw JSON</summary>
              <pre className='mt-2 overflow-x-auto whitespace-pre-wrap'>
                {JSON.stringify(generateState.resume, null, 2)}
              </pre>
            </details>
            <RevisionChat
              selectionSummary={describeSelection(generateState.resume, selectedIds)}
              selectionCount={selectedIds.size}
              loading={reviseState.state === 'loading'}
              errorMessage={reviseState.state === 'error' ? reviseState.message : null}
              onSubmit={handleRevise}
            />
          </div>
        )}

        {generateState.state === 'success' && generateState.kind === 'cover_letter' && (
          <div className='flex flex-col gap-2'>
            <p className='text-xs text-[var(--muted)]'>
              {selectedIds.size === 0
                ? 'Click a paragraph to select it.'
                : `Selected: ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`}
            </p>
            <CoverLetterPreview
              coverLetter={generateState.coverLetter}
              selectedIds={selectedIds}
              onToggle={toggleSelected}
            />
            <details className='text-xs text-[var(--muted)]'>
              <summary className='cursor-pointer select-none'>Raw JSON</summary>
              <pre className='mt-2 overflow-x-auto whitespace-pre-wrap'>
                {JSON.stringify(generateState.coverLetter, null, 2)}
              </pre>
            </details>
            <RevisionChat
              selectionSummary=''
              selectionCount={0}
              loading={false}
              errorMessage={null}
              onSubmit={() => {}}
              disabledReason="Cover letter editing isn't available yet — download and edit directly for now."
            />
          </div>
        )}
      </main>
    </div>
  )
}
