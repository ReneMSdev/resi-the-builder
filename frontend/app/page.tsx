'use client'

import { useEffect, useState } from 'react'
import { Application, CoverLetter, Profile, Resume } from './types'
import { ResumePreview } from './components/ResumePreview'
import { CoverLetterPreview } from './components/CoverLetterPreview'
import { RevisionChat } from './components/RevisionChat'
import { DownloadButtons } from './components/DownloadButtons'
import { SaveButton } from './components/SaveButton'
import { SavedTab } from './components/SavedTab'
import { ToastContainer } from './components/Toast'
import { HamburgerMenu } from './components/HamburgerMenu'
import { ProfileView } from './components/ProfileView'
import { DemoCapabilityBanner } from './components/DemoCapabilityBanner'
import { DemoIntroBanner } from './components/DemoIntroBanner'
import { ProgressBar } from './components/ProgressBar'
import { demoApplication, demoDelay, demoProfile } from './lib/demo'
import { useDemoMode } from './lib/DemoModeContext'
import { demoResumeRefinements, demoCoverLetterRefinements } from './lib/demoFixtures/refinements'
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

type Tab = 'jd' | 'resume' | 'cover_letter' | 'saved' | 'profile'

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

type ProfileLoadState =
  | { state: 'idle' }
  | { state: 'success'; profile: Profile }
  | { state: 'error'; message: string }

const MAX_HISTORY = 10
// Observed duration for a real Generate call, used as the progress bar's
// expected-completion estimate — see ProgressBar.tsx for how it's used.
const GENERATE_EXPECTED_MS = 40_000

function GenerateForm({
  jobDescription,
  onJobDescriptionChange,
  additionalContext,
  onAdditionalContextChange,
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
  additionalContext: string
  onAdditionalContextChange: (value: string) => void
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
        <span className='text-sm font-medium text-foreground'>Additional context (optional)</span>
        <textarea
          className='min-h-20 rounded border border-(--border) bg-(--surface) p-2 text-sm text-foreground'
          placeholder='Anything else worth factoring in: your relationship to the company, extra qualifications not in your profile, or other free-form context.'
          value={additionalContext}
          onChange={(e) => onAdditionalContextChange(e.target.value)}
        />
      </label>
      <div className='flex flex-col items-center gap-3'>
        <div className='flex flex-wrap justify-center gap-3'>
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
        {/* Sized against the whole form's width (matching the wide
            Resume/Cover-Letter preview content column this form sits in
            place of), not either button's own narrow footprint — each bar
            still tracks its own independent generating state. */}
        <div className='flex w-full flex-wrap justify-center gap-3'>
          {showResumeButton && (
            <ProgressBar
              active={resumeGenerating}
              expectedDurationMs={GENERATE_EXPECTED_MS}
              className='w-full max-w-96 mx-auto'
            />
          )}
          {showCoverLetterButton && (
            <ProgressBar
              active={coverLetterGenerating}
              expectedDurationMs={GENERATE_EXPECTED_MS}
              className='w-full max-w-96 mx-auto'
            />
          )}
        </div>
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
  const { demoMode } = useDemoMode()
  const [status, setStatus] = useState<BackendStatus>(() =>
    process.env.NEXT_PUBLIC_API_URL
      ? { state: 'loading' }
      : { state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' },
  )
  const [tab, setTab] = useState<Tab>('jd')
  // Pre-filled with the canned JD in demo mode so a visitor lands on a
  // realistic, ready-to-generate textarea instead of an empty one — see the
  // "Demo mode: generate-it-yourself landing flow" note in STATUS_FRONTEND.md.
  const [jobDescription, setJobDescription] = useState(() =>
    demoMode ? demoApplication.job_description.raw : '',
  )
  const [cleanedJobDescription, setCleanedJobDescription] = useState<string | null>(null)
  const [additionalContext, setAdditionalContext] = useState('')
  const [loadedApplication, setLoadedApplication] = useState<{ id: string; name: string } | null>(
    null,
  )
  // Deliberately separate from loadedApplication rather than reusing it for
  // this: loadedApplication also drives SaveButton's Save-vs-Update label
  // (isUpdate = applicationId !== null), and a freshly generated-but-never-
  // saved resume is supposed to still say "Save" — matching what the real
  // (non-demo) Generate flow already does. Reusing loadedApplication here
  // would make demo mode's Generate diverge from that established, already
  // regression-tested distinction just to also drive this button.
  const [demoHasGenerated, setDemoHasGenerated] = useState(false)
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
  const [resumeHistory, setResumeHistory] = useState<Resume[]>([])
  const [clHistory, setClHistory] = useState<CoverLetter[]>([])
  const [profileState, setProfileState] = useState<ProfileLoadState>(() => {
    if (demoMode) return { state: 'success', profile: demoProfile }
    return process.env.NEXT_PUBLIC_API_URL
      ? { state: 'idle' }
      : { state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' }
  })
  const [profilePreviewMode, setProfilePreviewMode] = useState<PreviewMode>('select')
  const [profileSelectedIds, setProfileSelectedIds] = useState<Set<string>>(new Set())
  const [profileReviseState, setProfileReviseState] = useState<ReviseState>({ state: 'idle' })
  const [profileHistory, setProfileHistory] = useState<Profile[]>([])
  const [profileOpenIds, setProfileOpenIds] = useState<Set<string>>(new Set())

  const selectedIds = tab === 'resume' ? resumeSelectedIds : clSelectedIds
  const setSelectedIds = tab === 'resume' ? setResumeSelectedIds : setClSelectedIds
  const reviseState = tab === 'resume' ? resumeReviseState : clReviseState
  const setReviseState = tab === 'resume' ? setResumeReviseState : setClReviseState
  const history = tab === 'resume' ? resumeHistory : clHistory

  const demoRefinements = tab === 'resume' ? demoResumeRefinements : demoCoverLetterRefinements
  const demoSelectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : undefined
  const demoPillAvailable = demoMode && demoSelectedId !== undefined && demoSelectedId in demoRefinements

  useEffect(() => {
    // Demo mode never reaches this — profileState is initialized straight to
    // 'success' with the demo fixture, so it's never 'idle' here. Guarded
    // explicitly anyway as a second line of defense against ever firing a
    // real network call in demo mode.
    if (demoMode) return
    if (tab !== 'profile' || profileState.state !== 'idle') return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    // profileState can only be 'idle' here if the initializer already found
    // NEXT_PUBLIC_API_URL set (otherwise it starts 'error') — this narrows the
    // type for the fetch call below without a redundant setState.
    if (!apiUrl) return

    fetch(`${apiUrl}/profile`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text()
          throw new Error(`${res.status}: ${body}`)
        }
        return res.json()
      })
      .then((profile: Profile) => setProfileState({ state: 'success', profile }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setProfileState({ state: 'error', message })
      })
    // demoMode never changes without a full page reload (see
    // DemoModeContext.tsx), so it doesn't need to be a reactive dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profileState.state])

  useEffect(() => {
    // Demo mode replaces this entire connectivity check with a static banner
    // in the top bar (see the JSX below) — no /health call ever fires.
    if (demoMode) return
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
    // demoMode never changes without a full page reload (see
    // DemoModeContext.tsx), so it doesn't need to be a reactive dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGenerate(kind: 'resume' | 'cover_letter') {
    if (kind === 'resume') {
      setResumeState({ state: 'loading' })
      setResumeSelectedIds(new Set())
    } else {
      setCoverLetterState({ state: 'loading' })
      setClSelectedIds(new Set())
    }

    if (demoMode) {
      // No LLM call in demo mode — always returns the same pre-baked
      // resume/cover-letter fixture regardless of what's typed above,
      // after an artificial delay so the loading state still reads as real.
      await demoDelay()
      if (demoApplication.job_description.cleaned) {
        setCleanedJobDescription(demoApplication.job_description.cleaned)
      }
      if (kind === 'resume' && demoApplication.resume) {
        setResumeState({ state: 'success', resume: demoApplication.resume })
      } else if (kind === 'cover_letter' && demoApplication.cover_letter) {
        setCoverLetterState({ state: 'success', coverLetter: demoApplication.cover_letter })
      }
      // Take the visitor straight to what they just "generated" instead of
      // leaving them on the JD tab to go find it — generating the other type
      // is untouched, so it still lands on its own tab independently.
      setTab(kind === 'resume' ? 'resume' : 'cover_letter')
      setDemoHasGenerated(true)
      return
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      if (kind === 'resume') {
        setResumeState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      } else {
        setCoverLetterState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      }
      return
    }

    try {
      const res = await fetch(`${apiUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_description: jobDescription,
          additional_context: additionalContext || undefined,
          type: kind,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      const data: {
        resume: Resume | null
        cover_letter: CoverLetter | null
        cleaned_job_description?: string | null
      } = await res.json()

      if (data.cleaned_job_description) {
        setCleanedJobDescription(data.cleaned_job_description)
      }

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
      if (demoMode) {
        // Demo mode is single-select only, so a pill can unambiguously say
        // what it edits: clicking the sole selected item deselects it,
        // clicking anything else replaces the selection outright rather than
        // adding to it.
        return prev.has(id) ? new Set() : new Set([id])
      }
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function pushResumeHistory(resume: Resume) {
    setResumeHistory((prev) => {
      const next = [...prev, resume]
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    })
  }

  function pushClHistory(coverLetter: CoverLetter) {
    setClHistory((prev) => {
      const next = [...prev, coverLetter]
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    })
  }

  function handleRevert() {
    if (tab === 'resume') {
      if (resumeHistory.length === 0) return
      const last = resumeHistory[resumeHistory.length - 1]
      setResumeHistory(resumeHistory.slice(0, -1))
      setResumeState({ state: 'success', resume: last })
    } else if (tab === 'cover_letter') {
      if (clHistory.length === 0) return
      const last = clHistory[clHistory.length - 1]
      setClHistory(clHistory.slice(0, -1))
      setCoverLetterState({ state: 'success', coverLetter: last })
    }
  }

  function handleEditField(id: string, text: string) {
    if (tab === 'resume' && resumeState.state === 'success') {
      pushResumeHistory(resumeState.resume)
      setResumeState({
        state: 'success',
        resume: applyRevisionUpdates(resumeState.resume, [{ id, text }]),
      })
    } else if (tab === 'cover_letter' && coverLetterState.state === 'success') {
      pushClHistory(coverLetterState.coverLetter)
      setCoverLetterState({
        state: 'success',
        coverLetter: applyCoverLetterUpdates(coverLetterState.coverLetter, [{ id, text }]),
      })
    }
  }

  function updateResume(updater: (resume: Resume) => Resume) {
    if (resumeState.state !== 'success') return
    pushResumeHistory(resumeState.resume)
    setResumeState({ state: 'success', resume: updater(resumeState.resume) })
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
  const handleRemoveLink = (linkId: string) => updateResume((resume) => removeLink(resume, linkId))
  const handleEditLink = (linkId: string, label: string, url: string) =>
    updateResume((resume) => editLink(resume, linkId, label, url))

  async function handleRevise(instruction: string) {
    if (tab === 'resume' ? resumeState.state !== 'success' : coverLetterState.state !== 'success') {
      return
    }

    if (demoMode) {
      // Free-text revise has no trigger path in demo mode — RevisionChat's
      // textarea/button are inert there, and the suggested-edit pill calls
      // handleApplyDemoRefinement directly instead. Guarded here too as
      // defense-in-depth in case onSubmit is ever reachable another way.
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
          job_description: cleanedJobDescription || jobDescription,
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

      if (tab === 'resume' && resumeState.state === 'success') {
        if (data.updates.length > 0) {
          pushResumeHistory(resumeState.resume)
          setResumeState({
            state: 'success',
            resume: applyRevisionUpdates(resumeState.resume, data.updates),
          })
        }
      } else if (tab === 'cover_letter' && coverLetterState.state === 'success') {
        if (data.updates.length > 0) {
          pushClHistory(coverLetterState.coverLetter)
          setCoverLetterState({
            state: 'success',
            coverLetter: applyCoverLetterUpdates(coverLetterState.coverLetter, data.updates),
          })
        }
      }
      setReviseState({ state: 'idle' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setReviseState({ state: 'error', message })
    }
  }

  async function handleApplyDemoRefinement() {
    if (!demoMode || !demoPillAvailable || demoSelectedId === undefined) return
    const text = demoRefinements[demoSelectedId]

    setReviseState({ state: 'loading' })
    await demoDelay()

    if (tab === 'resume' && resumeState.state === 'success') {
      pushResumeHistory(resumeState.resume)
      setResumeState({
        state: 'success',
        resume: applyRevisionUpdates(resumeState.resume, [{ id: demoSelectedId, text }]),
      })
    } else if (tab === 'cover_letter' && coverLetterState.state === 'success') {
      pushClHistory(coverLetterState.coverLetter)
      setCoverLetterState({
        state: 'success',
        coverLetter: applyCoverLetterUpdates(coverLetterState.coverLetter, [
          { id: demoSelectedId, text },
        ]),
      })
    }
    setReviseState({ state: 'idle' })
  }

  function handleSaved(application: Application) {
    setLoadedApplication({ id: application.id, name: application.name })
  }

  function handleLoadApplication(application: Application, targetTab: Tab) {
    setLoadedApplication({ id: application.id, name: application.name })
    setJobDescription(application.job_description.raw)
    setCleanedJobDescription(application.job_description.cleaned)
    setResumeState(
      application.resume ? { state: 'success', resume: application.resume } : { state: 'idle' },
    )
    setCoverLetterState(
      application.cover_letter
        ? { state: 'success', coverLetter: application.cover_letter }
        : { state: 'idle' },
    )
    setResumeSelectedIds(new Set())
    setClSelectedIds(new Set())
    setResumeReviseState({ state: 'idle' })
    setClReviseState({ state: 'idle' })
    setResumeHistory([])
    setClHistory([])
    setPreviewMode('select')
    setTab(targetTab)
  }

  function handleGenerateForNewJob() {
    setLoadedApplication(null)
    setDemoHasGenerated(false)
    // Re-populate the canned JD rather than resetting to blank in demo mode —
    // otherwise resetting would reintroduce the empty-textarea friction the
    // pre-filled landing state was added to avoid. Canned Generate ignores
    // the textarea's content either way, so this only affects what the
    // visitor sees, not what running Generate again produces.
    setJobDescription(demoMode ? demoApplication.job_description.raw : '')
    setCleanedJobDescription(null)
    setAdditionalContext('')
    setResumeState({ state: 'idle' })
    setCoverLetterState({ state: 'idle' })
    setResumeSelectedIds(new Set())
    setClSelectedIds(new Set())
    setResumeReviseState({ state: 'idle' })
    setClReviseState({ state: 'idle' })
    setResumeHistory([])
    setClHistory([])
    // In demo mode, profileState only ever reaches 'success' via the one-time
    // useState initializer — the fetch effect that would normally recover
    // an 'idle' state is deliberately never called in demo mode. Resetting
    // to 'idle' here would permanently strand the Profile tab on "Loading
    // profile..." for the rest of the session, since nothing ever moves it
    // off 'idle' again. Reset straight back to the fixture instead.
    setProfileState(demoMode ? { state: 'success', profile: demoProfile } : { state: 'idle' })
    setProfilePreviewMode('select')
    setProfileSelectedIds(new Set())
    setProfileReviseState({ state: 'idle' })
    setProfileHistory([])
    setProfileOpenIds(new Set())
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
  const showingRevisionChat =
    (tab === 'resume' && resumeReady) ||
    (tab === 'cover_letter' && coverLetterReady) ||
    (tab === 'profile' && profileState.state === 'success')
  const isContentTab = tab === 'jd' || tab === 'resume' || tab === 'cover_letter'

  return (
    <div className='flex h-full flex-col items-center overflow-hidden bg-background font-sans'>
      <div className='flex w-full items-center justify-between border-b border-(--border) bg-(--topbar-bg) py-3 px-12.5'>
        <div className='flex items-center gap-3'>
          <HamburgerMenu onSelect={(view) => setTab(view)} />
          <span
            className='text-xl font-bold tracking-tight text-(--accent)'
            style={{ fontFamily: 'var(--font-roboto-mono)' }}
          >
            Resume Builder
          </span>
        </div>
        {demoMode ? (
          <p className='text-sm font-medium text-(--success-on-dark)'>
            Demo Mode — sample data only, no live backend
          </p>
        ) : (
          <>
            {status.state === 'loading' && (
              <p className='text-sm text-(--muted)'>Checking backend...</p>
            )}
            {status.state === 'ok' && (
              <p className='text-sm font-medium text-(--success-on-dark)'>Backend: ok</p>
            )}
            {status.state === 'error' && (
              <p className='text-sm font-medium text-(--danger)'>
                Backend unreachable: {status.message}
              </p>
            )}
          </>
        )}
        <div className='flex items-center gap-3'>
          {(loadedApplication || demoHasGenerated) && (
            <button
              type='button'
              onClick={() => setTab('jd')}
              className='rounded border border-(--border) px-4 py-2 text-sm font-medium text-(--surface) transition-colors hover:cursor-pointer hover:bg-white/10'
            >
              Current Application
            </button>
          )}
          <button
            type='button'
            onClick={handleGenerateForNewJob}
            className='rounded bg-(--accent) px-4 py-2 text-sm font-medium text-(--surface) transition-colors hover:cursor-pointer hover:bg-(--accent-hover)'
          >
            Generate for new job
          </button>
        </div>
      </div>

      <main className='app-scrollbar min-h-0 w-full flex-1 overflow-y-auto'>
        <div
          className={`mx-auto flex w-full max-w-3xl flex-col gap-8 px-16 pt-8 ${
            showingRevisionChat ? '' : 'pb-8'
          }`}
        >
          {demoMode && <DemoIntroBanner />}
          {isContentTab && (
            <div className='w-full border-b border-(--border) pb-6'>
              <div className='flex gap-2 justify-center'>
                <button
                  type='button'
                  onClick={() => setTab('jd')}
                  className={tabClass('jd')}
                >
                  Job Description
                </button>
                <button
                  type='button'
                  onClick={() => setTab('resume')}
                  className={tabClass('resume')}
                >
                  Resume
                </button>
                <button
                  type='button'
                  onClick={() => setTab('cover_letter')}
                  className={tabClass('cover_letter')}
                >
                  Cover Letter
                </button>
              </div>
            </div>
          )}

          {tab === 'saved' && (
            <>
              {demoMode && (
                <DemoCapabilityBanner message="In the full app, save and manage multiple job-application packages, each bundling its job description, tailored resume, and cover letter for quick reuse." />
              )}
              <SavedTab onLoad={handleLoadApplication} />
            </>
          )}

          {tab === 'profile' && (
            <>
              {demoMode && (
                <DemoCapabilityBanner message="This is a read-only demo of your master profile. In the full app, every field is editable — including AI-assisted revision — and changes here update the source data used for future generations." />
              )}
              {profileState.state === 'success' ? (
              <ProfileView
                profile={profileState.profile}
                onProfileChange={(profile) => setProfileState({ state: 'success', profile })}
                previewMode={profilePreviewMode}
                setPreviewMode={setProfilePreviewMode}
                selectedIds={profileSelectedIds}
                setSelectedIds={setProfileSelectedIds}
                reviseState={profileReviseState}
                setReviseState={setProfileReviseState}
                history={profileHistory}
                setHistory={setProfileHistory}
                openIds={profileOpenIds}
                setOpenIds={setProfileOpenIds}
              />
              ) : profileState.state === 'error' ? (
                <p className='font-medium text-(--danger)'>
                  Error loading profile: {profileState.message}
                </p>
              ) : (
                <p className='text-sm text-(--muted)'>Loading profile...</p>
              )}
            </>
          )}

          {isContentTab && (
            <>
              {tab === 'jd' && (
                <>
                  {demoMode && (
                    <DemoCapabilityBanner message="This demo uses a pre-written job description and pre-generated results. In the full app, Claude reads any real job posting and tailors your resume and cover letter to it automatically." />
                  )}
                  {(resumeReady || coverLetterReady) ? (
                    <div className='flex flex-col gap-2'>
                      <p className='text-xs text-(--muted)'>Job description (reference)</p>
                      <div className='whitespace-pre-wrap rounded border border-(--border) bg-(--surface) p-3 text-sm text-foreground'>
                        {cleanedJobDescription || jobDescription}
                      </div>
                    </div>
                  ) : (
                    <GenerateForm
                      jobDescription={jobDescription}
                      onJobDescriptionChange={setJobDescription}
                      additionalContext={additionalContext}
                      onAdditionalContextChange={setAdditionalContext}
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
                  )}
                </>
              )}

              {tab === 'resume' && (
                <>
                  {demoMode && (
                    <DemoCapabilityBanner
                      message={
                        <>
                          In the full app, an AI model (Claude) generates every bullet,
                          summary, and skill section tailored to the job.
                          <br />
                          <strong>Select</strong> mode lets you pick a bullet, entry, or
                          section and revise it live via chat instructions;{' '}
                          <strong>Edit</strong> mode lets you type changes in directly.
                        </>
                      }
                    />
                  )}
                  {resumeState.state === 'success' ? (
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
                        <ModeToggle
                          mode={previewMode}
                          onChange={setPreviewMode}
                        />
                        <SaveButton
                          jobDescription={{ raw: jobDescription, cleaned: cleanedJobDescription }}
                          resume={resumeState.resume}
                          coverLetter={coverLetterState.state === 'success' ? coverLetterState.coverLetter : null}
                          applicationId={loadedApplication?.id ?? null}
                          initialName={loadedApplication?.name ?? ''}
                          onSaved={handleSaved}
                        />
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
                      canRevert={history.length > 0}
                      onRevert={handleRevert}
                      demoMode={demoMode}
                      demoPillAvailable={demoPillAvailable}
                      onApplyDemoRefinement={handleApplyDemoRefinement}
                    />
                  </div>
                ) : (
                  <GenerateForm
                    jobDescription={jobDescription}
                    onJobDescriptionChange={setJobDescription}
                    additionalContext={additionalContext}
                    onAdditionalContextChange={setAdditionalContext}
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
                )}
                </>
              )}

              {tab === 'cover_letter' && (
                <>
                  {demoMode && (
                    <DemoCapabilityBanner
                      message={
                        <>
                          In the full app, Claude writes a complete, tailored cover
                          letter for each job.
                          <br />
                          <strong>Select</strong> mode lets you pick a paragraph and
                          revise it live via chat instructions; <strong>Edit</strong>{' '}
                          mode lets you type changes in directly.
                        </>
                      }
                    />
                  )}
                  {coverLetterState.state === 'success' ? (
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
                        <ModeToggle
                          mode={previewMode}
                          onChange={setPreviewMode}
                        />
                        <SaveButton
                          jobDescription={{ raw: jobDescription, cleaned: cleanedJobDescription }}
                          resume={resumeState.state === 'success' ? resumeState.resume : null}
                          coverLetter={coverLetterState.coverLetter}
                          applicationId={loadedApplication?.id ?? null}
                          initialName={loadedApplication?.name ?? ''}
                          onSaved={handleSaved}
                        />
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
                      canRevert={history.length > 0}
                      onRevert={handleRevert}
                      demoMode={demoMode}
                      demoPillAvailable={demoPillAvailable}
                      onApplyDemoRefinement={handleApplyDemoRefinement}
                    />
                  </div>
                ) : (
                  <GenerateForm
                    jobDescription={jobDescription}
                    onJobDescriptionChange={setJobDescription}
                    additionalContext={additionalContext}
                    onAdditionalContextChange={setAdditionalContext}
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
                )}
                </>
              )}
            </>
          )}
        </div>
      </main>
      <ToastContainer />
    </div>
  )
}
