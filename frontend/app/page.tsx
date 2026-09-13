'use client'

import { SubmitEvent, useEffect, useState } from 'react'
import { CoverLetter, Resume, SavedItem } from './types'
import { ResumePreview } from './components/ResumePreview'
import { CoverLetterPreview } from './components/CoverLetterPreview'
import { RevisionChat } from './components/RevisionChat'
import { DownloadButtons } from './components/DownloadButtons'
import { SaveButton } from './components/SaveButton'
import { SavedTab } from './components/SavedTab'
import {
  applyRevisionUpdates,
  applyCoverLetterUpdates,
  describeSelection,
  describeCoverLetterSelection,
} from './lib/resume'

type BackendStatus = { state: 'loading' } | { state: 'ok' } | { state: 'error'; message: string }

type Mode = 'resume' | 'cover_letter' | 'saved'

type ResumeGenerateState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success'; resume: Resume }
  | { state: 'error'; message: string }

type CoverLetterGenerateState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success'; coverLetter: CoverLetter }
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
  const [resumeState, setResumeState] = useState<ResumeGenerateState>({
    state: 'idle',
  })
  const [coverLetterState, setCoverLetterState] = useState<CoverLetterGenerateState>({
    state: 'idle',
  })
  const [resumeSelectedIds, setResumeSelectedIds] = useState<Set<string>>(new Set())
  const [clSelectedIds, setClSelectedIds] = useState<Set<string>>(new Set())
  const [resumeReviseState, setResumeReviseState] = useState<ReviseState>({
    state: 'idle',
  })
  const [clReviseState, setClReviseState] = useState<ReviseState>({
    state: 'idle',
  })

  const selectedIds = mode === 'resume' ? resumeSelectedIds : clSelectedIds
  const setSelectedIds = mode === 'resume' ? setResumeSelectedIds : setClSelectedIds
  const reviseState = mode === 'resume' ? resumeReviseState : clReviseState
  const setReviseState = mode === 'resume' ? setResumeReviseState : setClReviseState

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

  async function handleGenerate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (mode === 'saved') return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      if (mode === 'resume') {
        setResumeState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      } else {
        setCoverLetterState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      }
      return
    }

    if (mode === 'resume') {
      setResumeState({ state: 'loading' })
    } else {
      setCoverLetterState({ state: 'loading' })
    }
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
        setResumeState({ state: 'success', resume: data.resume })
      } else {
        if (!data.cover_letter) {
          throw new Error('Response did not include a cover letter.')
        }
        setCoverLetterState({ state: 'success', coverLetter: data.cover_letter })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (mode === 'resume') {
        setResumeState({ state: 'error', message })
      } else {
        setCoverLetterState({ state: 'error', message })
      }
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
    if (mode === 'resume' ? resumeState.state !== 'success' : coverLetterState.state !== 'success') {
      return
    }

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
          ...(mode === 'resume' && resumeState.state === 'success'
            ? { resume: resumeState.resume }
            : coverLetterState.state === 'success'
              ? { cover_letter: coverLetterState.coverLetter }
              : {}),
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      const data: { updates: { id: string; text: string }[] } = await res.json()

      if (mode === 'resume') {
        setResumeState((prev) => {
          if (prev.state !== 'success') return prev
          return { state: 'success', resume: applyRevisionUpdates(prev.resume, data.updates) }
        })
      } else {
        setCoverLetterState((prev) => {
          if (prev.state !== 'success') return prev
          return {
            state: 'success',
            coverLetter: applyCoverLetterUpdates(prev.coverLetter, data.updates),
          }
        })
      }
      setReviseState({ state: 'idle' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setReviseState({ state: 'error', message })
    }
  }

  function handleModeChange(newMode: Mode) {
    setMode(newMode)
  }

  function handleLoadSavedItem(item: SavedItem) {
    if (item.type === 'resume') {
      setResumeState({ state: 'success', resume: item.data as Resume })
      setResumeSelectedIds(new Set())
    } else {
      setCoverLetterState({ state: 'success', coverLetter: item.data as CoverLetter })
      setClSelectedIds(new Set())
    }
    setMode(item.type)
  }

  const isGenerating =
    mode === 'resume'
      ? resumeState.state === 'loading'
      : mode === 'cover_letter'
        ? coverLetterState.state === 'loading'
        : false

  const tabClass = (tab: Mode) =>
    `rounded px-3 py-1.5 text-sm font-medium transition-colors hover:cursor-pointer ${
      mode === tab
        ? 'bg-(--accent) text-(--surface)'
        : 'border border-(--border) text-foreground hover:bg-(--accent-soft)'
    }`

  return (
    <div className='flex flex-col flex-1 items-center bg-background font-sans'>
      <main className='flex flex-1 w-full max-w-3xl flex-col gap-8 py-16 px-16'>
        <div className='flex flex-col items-center gap-2'>
          <h1 className='text-2xl font-semibold text-foreground'>Resume Builder</h1>
          {status.state === 'loading' && (
            <p className='text-sm text-(--muted)'>Checking backend...</p>
          )}
          {status.state === 'ok' && (
            <p className='text-sm font-medium text-(--success)'>Backend: ok</p>
          )}
          {status.state === 'error' && (
            <p className='text-sm font-medium text-(--danger)'>
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
          <button
            type='button'
            onClick={() => handleModeChange('saved')}
            className={tabClass('saved')}
          >
            Saved
          </button>
        </div>

        {mode === 'saved' && <SavedTab onLoad={handleLoadSavedItem} />}

        {mode !== 'saved' && (
        <form
          onSubmit={handleGenerate}
          className='flex flex-col gap-4'
        >
          <label className='flex flex-col gap-1'>
            <span className='text-sm font-medium text-foreground'>Job description</span>
            <textarea
              className='min-h-40 rounded border border-(--border) bg-(--surface) p-2 text-sm text-foreground'
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              required
            />
          </label>
          <label className='flex flex-col gap-1'>
            <span className='text-sm font-medium text-foreground'>
              Company context (optional)
            </span>
            <textarea
              className='min-h-20 rounded border border-(--border) bg-(--surface) p-2 text-sm text-foreground'
              value={companyContext}
              onChange={(e) => setCompanyContext(e.target.value)}
            />
          </label>
          <button
            type='submit'
            disabled={isGenerating || !jobDescription.trim()}
            className='self-start rounded bg-(--accent) px-4 py-2 text-sm font-medium text-(--surface) transition-colors hover:bg-(--accent-hover) disabled:opacity-50 hover:cursor-pointer'
          >
            {isGenerating
              ? 'Generating...'
              : mode === 'resume'
                ? 'Generate Resume'
                : 'Generate Cover Letter'}
          </button>
        </form>
        )}

        {mode === 'resume' && resumeState.state === 'error' && (
          <p className='font-medium text-(--danger)'>
            Error generating resume: {resumeState.message}
          </p>
        )}

        {mode === 'cover_letter' && coverLetterState.state === 'error' && (
          <p className='font-medium text-(--danger)'>
            Error generating cover letter: {coverLetterState.message}
          </p>
        )}

        {mode === 'resume' && resumeState.state === 'success' && (
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-xs text-(--muted)'>
                {selectedIds.size === 0
                  ? 'Click a bullet, entry, or section to select it.'
                  : `Selected: ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`}
              </p>
              <div className='flex items-center gap-2'>
                <SaveButton type='resume' document={resumeState.resume} />
                <DownloadButtons document={{ resume: resumeState.resume }} />
              </div>
            </div>
            <ResumePreview
              resume={resumeState.resume}
              selectedIds={selectedIds}
              onToggle={toggleSelected}
            />
            <details className='text-xs text-(--muted)'>
              <summary className='cursor-pointer select-none'>Raw JSON</summary>
              <pre className='mt-2 overflow-x-auto whitespace-pre-wrap'>
                {JSON.stringify(resumeState.resume, null, 2)}
              </pre>
            </details>
            <RevisionChat
              selectionSummary={describeSelection(resumeState.resume, selectedIds)}
              selectionCount={selectedIds.size}
              loading={reviseState.state === 'loading'}
              errorMessage={reviseState.state === 'error' ? reviseState.message : null}
              onSubmit={handleRevise}
            />
          </div>
        )}

        {mode === 'cover_letter' && coverLetterState.state === 'success' && (
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-xs text-(--muted)'>
                {selectedIds.size === 0
                  ? 'Click a paragraph to select it.'
                  : `Selected: ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`}
              </p>
              <div className='flex items-center gap-2'>
                <SaveButton type='cover_letter' document={coverLetterState.coverLetter} />
                <DownloadButtons document={{ coverLetter: coverLetterState.coverLetter }} />
              </div>
            </div>
            <CoverLetterPreview
              coverLetter={coverLetterState.coverLetter}
              selectedIds={selectedIds}
              onToggle={toggleSelected}
            />
            <details className='text-xs text-(--muted)'>
              <summary className='cursor-pointer select-none'>Raw JSON</summary>
              <pre className='mt-2 overflow-x-auto whitespace-pre-wrap'>
                {JSON.stringify(coverLetterState.coverLetter, null, 2)}
              </pre>
            </details>
            <RevisionChat
              selectionSummary={describeCoverLetterSelection(
                coverLetterState.coverLetter,
                selectedIds,
              )}
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
