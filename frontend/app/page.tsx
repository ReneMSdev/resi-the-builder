'use client'

import { useEffect, useState } from 'react'
import { Resume } from './types'
import { ResumePreview } from './components/ResumePreview'
import { RevisionChat } from './components/RevisionChat'
import { applyRevisionUpdates, describeSelection } from './lib/resume'

type BackendStatus = { state: 'loading' } | { state: 'ok' } | { state: 'error'; message: string }

type GenerateState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success'; resume: Resume }
  | { state: 'error'; message: string }

type ReviseState = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string }

export default function Home() {
  const [status, setStatus] = useState<BackendStatus>(() =>
    process.env.NEXT_PUBLIC_API_URL
      ? { state: 'loading' }
      : { state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' },
  )
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
          type: 'resume',
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      const data: { resume: Resume | null } = await res.json()
      if (!data.resume) {
        throw new Error('Response did not include a resume.')
      }

      setGenerateState({ state: 'success', resume: data.resume })
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
    if (generateState.state !== 'success') return

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
        prev.state === 'success'
          ? {
              state: 'success',
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

  const isGenerating = generateState.state === 'loading'

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
            {isGenerating ? 'Generating...' : 'Generate Resume'}
          </button>
        </form>

        {generateState.state === 'error' && (
          <p className='font-medium text-[var(--danger)]'>
            Error generating resume: {generateState.message}
          </p>
        )}

        {generateState.state === 'success' && (
          <div className='flex flex-col gap-2'>
            <p className='text-xs text-[var(--muted)]'>
              {selectedIds.size === 0
                ? 'Click a bullet or entry to select it.'
                : `Selected: ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`}
            </p>
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
      </main>
    </div>
  )
}
