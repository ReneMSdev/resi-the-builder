'use client'

import { useEffect, useState } from 'react'
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
  addBullet,
  removeBullet,
  addSkillItem,
  removeSkillItem,
  editSkillItem,
  addLink,
  removeLink,
  editLink,
} from './lib/resume'

type PreviewMode = 'select' | 'edit'

function ModeToggle({
  mode,
  onChange,
}: {
  mode: PreviewMode
  onChange: (mode: PreviewMode) => void
}) {
  return (
    <div className='inline-flex overflow-hidden rounded border border-(--border)'>
      <button
        type='button'
        onClick={() => onChange('select')}
        className={`px-2 py-1 text-xs font-medium transition-colors hover:cursor-pointer ${
          mode === 'select'
            ? 'bg-(--accent) text-(--surface)'
            : 'bg-(--surface) text-foreground hover:bg-(--accent-soft)'
        }`}
      >
        Select
      </button>
      <button
        type='button'
        onClick={() => onChange('edit')}
        className={`px-2 py-1 text-xs font-medium transition-colors hover:cursor-pointer ${
          mode === 'edit'
            ? 'bg-(--edit) text-(--surface)'
            : 'bg-(--surface) text-foreground hover:bg-(--edit-soft)'
        }`}
      >
        Edit
      </button>
    </div>
  )
}

type BackendStatus = { state: 'loading' } | { state: 'ok' } | { state: 'error'; message: string }

type Tab = 'jd' | 'resume' | 'cover_letter' | 'saved'

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

function GenerateForm({
  jobDescription,
  onJobDescriptionChange,
  companyContext,
  onCompanyContextChange,
  showResumeButton,
  showCoverLetterButton,
  resumeGenerating,
  coverLetterGenerating,
  resumeError,
  coverLetterError,
  onGenerateResume,
  onGenerateCoverLetter,
}: {
  jobDescription: string
  onJobDescriptionChange: (value: string) => void
  companyContext: string
  onCompanyContextChange: (value: string) => void
  showResumeButton: boolean
  showCoverLetterButton: boolean
  resumeGenerating: boolean
  coverLetterGenerating: boolean
  resumeError: string | null
  coverLetterError: string | null
  onGenerateResume: () => void
  onGenerateCoverLetter: () => void
}) {
  const canGenerate = jobDescription.trim().length > 0

  return (
    <div className='flex flex-col gap-4'>
      <label className='flex flex-col gap-1'>
        <span className='text-sm font-medium text-foreground'>Job description</span>
        <textarea
          className='min-h-40 rounded border border-(--border) bg-(--surface) p-2 text-sm text-foreground'
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
        />
      </label>
      <label className='flex flex-col gap-1'>
        <span className='text-sm font-medium text-foreground'>Company context (optional)</span>
        <textarea
          className='min-h-20 rounded border border-(--border) bg-(--surface) p-2 text-sm text-foreground'
          value={companyContext}
          onChange={(e) => onCompanyContextChange(e.target.value)}
        />
      </label>
      <div className='flex flex-wrap items-center gap-3'>
        {showResumeButton && (
          <button
            type='button'
            onClick={onGenerateResume}
            disabled={resumeGenerating || !canGenerate}
            className='rounded bg-(--accent) px-4 py-2 text-sm font-medium text-(--surface) transition-colors hover:cursor-pointer hover:bg-(--accent-hover) disabled:opacity-50'
          >
            {resumeGenerating ? 'Generating...' : 'Generate Resume'}
          </button>
        )}
        {showCoverLetterButton && (
          <button
            type='button'
            onClick={onGenerateCoverLetter}
            disabled={coverLetterGenerating || !canGenerate}
            className='rounded bg-(--accent) px-4 py-2 text-sm font-medium text-(--surface) transition-colors hover:cursor-pointer hover:bg-(--accent-hover) disabled:opacity-50'
          >
            {coverLetterGenerating ? 'Generating...' : 'Generate Cover Letter'}
          </button>
        )}
      </div>
      {resumeError && (
        <p className='font-medium text-(--danger)'>Error generating resume: {resumeError}</p>
      )}
      {coverLetterError && (
        <p className='font-medium text-(--danger)'>
          Error generating cover letter: {coverLetterError}
        </p>
      )}
    </div>
  )
}

export default function Home() {
  const [status, setStatus] = useState<BackendStatus>(() =>
    process.env.NEXT_PUBLIC_API_URL
      ? { state: 'loading' }
      : { state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' },
  )
  const [tab, setTab] = useState<Tab>('jd')
  const [jobDescription, setJobDescription] = useState('')
  const [companyContext, setCompanyContext] = useState('')
  const [resumeState, setResumeState] = useState<ResumeGenerateState>({
    state: 'idle',
  })
  const [coverLetterState, setCoverLetterState] = useState<CoverLetterGenerateState>({
    state: 'idle',
  })
  const [previewMode, setPreviewMode] = useState<PreviewMode>('select')
  const [resumeSelectedIds, setResumeSelectedIds] = useState<Set<string>>(new Set())
  const [clSelectedIds, setClSelectedIds] = useState<Set<string>>(new Set())
  const [resumeReviseState, setResumeReviseState] = useState<ReviseState>({
    state: 'idle',
  })
  const [clReviseState, setClReviseState] = useState<ReviseState>({
    state: 'idle',
  })

  const selectedIds = tab === 'resume' ? resumeSelectedIds : clSelectedIds
  const setSelectedIds = tab === 'resume' ? setResumeSelectedIds : setClSelectedIds
  const reviseState = tab === 'resume' ? resumeReviseState : clReviseState
  const setReviseState = tab === 'resume' ? setResumeReviseState : setClReviseState

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

  async function handleGenerate(kind: 'resume' | 'cover_letter') {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      if (kind === 'resume') {
        setResumeState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      } else {
        setCoverLetterState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      }
      return
    }

    if (kind === 'resume') {
      setResumeState({ state: 'loading' })
      setResumeSelectedIds(new Set())
    } else {
      setCoverLetterState({ state: 'loading' })
      setClSelectedIds(new Set())
    }

    try {
      const res = await fetch(`${apiUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_description: jobDescription,
          company_context: companyContext || undefined,
          type: kind,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      const data: { resume: Resume | null; cover_letter: CoverLetter | null } = await res.json()

      if (kind === 'resume') {
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
      if (kind === 'resume') {
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

  function handleEditField(id: string, text: string) {
    if (tab === 'resume') {
      setResumeState((prev) =>
        prev.state !== 'success'
          ? prev
          : { state: 'success', resume: applyRevisionUpdates(prev.resume, [{ id, text }]) },
      )
    } else if (tab === 'cover_letter') {
      setCoverLetterState((prev) =>
        prev.state !== 'success'
          ? prev
          : {
              state: 'success',
              coverLetter: applyCoverLetterUpdates(prev.coverLetter, [{ id, text }]),
            },
      )
    }
  }

  function updateResume(updater: (resume: Resume) => Resume) {
    setResumeState((prev) =>
      prev.state !== 'success' ? prev : { state: 'success', resume: updater(prev.resume) },
    )
  }

  const handleAddBullet = (entryId: string, text: string) =>
    updateResume((resume) => addBullet(resume, entryId, text))
  const handleRemoveBullet = (bulletId: string) =>
    updateResume((resume) => removeBullet(resume, bulletId))
  const handleAddSkillItem = (groupId: string, text: string) =>
    updateResume((resume) => addSkillItem(resume, groupId, text))
  const handleRemoveSkillItem = (groupId: string, itemId: string) =>
    updateResume((resume) => removeSkillItem(resume, groupId, itemId))
  const handleEditSkillItem = (groupId: string, itemId: string, text: string) =>
    updateResume((resume) => editSkillItem(resume, groupId, itemId, text))
  const handleAddLink = (label: string, url: string) =>
    updateResume((resume) => addLink(resume, label, url))
  const handleRemoveLink = (linkId: string) =>
    updateResume((resume) => removeLink(resume, linkId))
  const handleEditLink = (linkId: string, label: string, url: string) =>
    updateResume((resume) => editLink(resume, linkId, label, url))

  async function handleRevise(instruction: string) {
    if (tab === 'resume' ? resumeState.state !== 'success' : coverLetterState.state !== 'success') {
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
          ...(tab === 'resume' && resumeState.state === 'success'
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

      if (tab === 'resume') {
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

  function handleLoadSavedItem(item: SavedItem) {
    if (item.type === 'resume') {
      setResumeState({ state: 'success', resume: item.data as Resume })
      setResumeSelectedIds(new Set())
    } else {
      setCoverLetterState({ state: 'success', coverLetter: item.data as CoverLetter })
      setClSelectedIds(new Set())
    }
    setTab(item.type)
  }

  function handleGenerateForNewJob() {
    setJobDescription('')
    setCompanyContext('')
    setResumeState({ state: 'idle' })
    setCoverLetterState({ state: 'idle' })
    setResumeSelectedIds(new Set())
    setClSelectedIds(new Set())
    setResumeReviseState({ state: 'idle' })
    setClReviseState({ state: 'idle' })
    setPreviewMode('select')
    setTab('jd')
  }

  const tabClass = (t: Tab) =>
    `rounded px-3 py-1.5 text-sm font-medium transition-colors hover:cursor-pointer ${
      tab === t
        ? 'bg-(--accent) text-(--surface)'
        : 'border border-(--border) text-foreground hover:bg-(--accent-soft)'
    }`

  const resumeGenerating = resumeState.state === 'loading'
  const coverLetterGenerating = coverLetterState.state === 'loading'
  const resumeReady = resumeState.state === 'success'
  const coverLetterReady = coverLetterState.state === 'success'

  return (
    <div className='flex flex-col flex-1 items-center bg-background font-sans'>
      <div className='flex w-full items-center justify-between border-b border-(--border) bg-(--surface) py-4 px-[50px]'>
        <span className='font-serif text-xl font-bold tracking-tight text-foreground'>
          Resume Builder
        </span>
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
        <button
          type='button'
          onClick={handleGenerateForNewJob}
          className='rounded bg-(--accent) px-4 py-2 text-sm font-medium text-(--surface) transition-colors hover:cursor-pointer hover:bg-(--accent-hover)'
        >
          Generate for new job
        </button>
      </div>

      <main className='flex flex-1 w-full max-w-3xl flex-col gap-8 py-8 px-16'>
        <div className='flex gap-2 self-center'>
          <button type='button' onClick={() => setTab('jd')} className={tabClass('jd')}>
            Job Description
          </button>
          <button type='button' onClick={() => setTab('resume')} className={tabClass('resume')}>
            Resume
          </button>
          <button
            type='button'
            onClick={() => setTab('cover_letter')}
            className={tabClass('cover_letter')}
          >
            Cover Letter
          </button>
          <button type='button' onClick={() => setTab('saved')} className={tabClass('saved')}>
            Saved
          </button>
        </div>

        {tab === 'saved' && <SavedTab onLoad={handleLoadSavedItem} />}

        {tab !== 'saved' && (
          <>
            {tab === 'jd' &&
              (resumeReady && coverLetterReady ? (
                <div className='flex flex-col gap-2'>
                  <p className='text-xs text-(--muted)'>Job description (reference)</p>
                  <div className='whitespace-pre-wrap rounded border border-(--border) bg-(--surface) p-3 text-sm text-foreground'>
                    {jobDescription}
                  </div>
                </div>
              ) : (
                <GenerateForm
                  jobDescription={jobDescription}
                  onJobDescriptionChange={setJobDescription}
                  companyContext={companyContext}
                  onCompanyContextChange={setCompanyContext}
                  showResumeButton={!resumeReady}
                  showCoverLetterButton={!coverLetterReady}
                  resumeGenerating={resumeGenerating}
                  coverLetterGenerating={coverLetterGenerating}
                  resumeError={resumeState.state === 'error' ? resumeState.message : null}
                  coverLetterError={
                    coverLetterState.state === 'error' ? coverLetterState.message : null
                  }
                  onGenerateResume={() => handleGenerate('resume')}
                  onGenerateCoverLetter={() => handleGenerate('cover_letter')}
                />
              ))}

            {tab === 'resume' &&
              (resumeState.state === 'success' ? (
                <div className='flex flex-col gap-2'>
                  <div className='flex items-center justify-between gap-2'>
                    <p className='text-xs text-(--muted)'>
                      {previewMode === 'edit'
                        ? 'Edit mode: click any field to edit it.'
                        : selectedIds.size === 0
                          ? 'Click a bullet, entry, or section to select it.'
                          : `Selected: ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`}
                    </p>
                    <div className='flex items-center gap-2'>
                      <ModeToggle mode={previewMode} onChange={setPreviewMode} />
                      <SaveButton type='resume' document={resumeState.resume} />
                      <DownloadButtons document={{ resume: resumeState.resume }} />
                    </div>
                  </div>
                  <ResumePreview
                    resume={resumeState.resume}
                    selectedIds={selectedIds}
                    onToggle={toggleSelected}
                    mode={previewMode}
                    onEditField={handleEditField}
                    onAddBullet={handleAddBullet}
                    onRemoveBullet={handleRemoveBullet}
                    onAddSkillItem={handleAddSkillItem}
                    onRemoveSkillItem={handleRemoveSkillItem}
                    onEditSkillItem={handleEditSkillItem}
                    onAddLink={handleAddLink}
                    onRemoveLink={handleRemoveLink}
                    onEditLink={handleEditLink}
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
              ) : (
                <GenerateForm
                  jobDescription={jobDescription}
                  onJobDescriptionChange={setJobDescription}
                  companyContext={companyContext}
                  onCompanyContextChange={setCompanyContext}
                  showResumeButton={!resumeReady}
                  showCoverLetterButton={!coverLetterReady}
                  resumeGenerating={resumeGenerating}
                  coverLetterGenerating={coverLetterGenerating}
                  resumeError={resumeState.state === 'error' ? resumeState.message : null}
                  coverLetterError={
                    coverLetterState.state === 'error' ? coverLetterState.message : null
                  }
                  onGenerateResume={() => handleGenerate('resume')}
                  onGenerateCoverLetter={() => handleGenerate('cover_letter')}
                />
              ))}

            {tab === 'cover_letter' &&
              (coverLetterState.state === 'success' ? (
                <div className='flex flex-col gap-2'>
                  <div className='flex items-center justify-between gap-2'>
                    <p className='text-xs text-(--muted)'>
                      {previewMode === 'edit'
                        ? 'Edit mode: click any field to edit it.'
                        : selectedIds.size === 0
                          ? 'Click a paragraph to select it.'
                          : `Selected: ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`}
                    </p>
                    <div className='flex items-center gap-2'>
                      <ModeToggle mode={previewMode} onChange={setPreviewMode} />
                      <SaveButton type='cover_letter' document={coverLetterState.coverLetter} />
                      <DownloadButtons document={{ coverLetter: coverLetterState.coverLetter }} />
                    </div>
                  </div>
                  <CoverLetterPreview
                    coverLetter={coverLetterState.coverLetter}
                    selectedIds={selectedIds}
                    onToggle={toggleSelected}
                    mode={previewMode}
                    onEditField={handleEditField}
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
              ) : (
                <GenerateForm
                  jobDescription={jobDescription}
                  onJobDescriptionChange={setJobDescription}
                  companyContext={companyContext}
                  onCompanyContextChange={setCompanyContext}
                  showResumeButton={!resumeReady}
                  showCoverLetterButton={!coverLetterReady}
                  resumeGenerating={resumeGenerating}
                  coverLetterGenerating={coverLetterGenerating}
                  resumeError={resumeState.state === 'error' ? resumeState.message : null}
                  coverLetterError={
                    coverLetterState.state === 'error' ? coverLetterState.message : null
                  }
                  onGenerateResume={() => handleGenerate('resume')}
                  onGenerateCoverLetter={() => handleGenerate('cover_letter')}
                />
              ))}
          </>
        )}
      </main>
    </div>
  )
}
