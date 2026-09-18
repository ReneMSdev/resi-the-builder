'use client'

import { useEffect, useRef, useState } from 'react'
import { Application, ApplicationSummary } from '../types'
import { buildAutoApplyPrompt } from '../lib/autoApplyPrompt'
import { demoApplication, demoApplications } from '../lib/demo'
import { useDemoMode } from '../lib/DemoModeContext'
import { showToast } from './Toast'

type ListState =
  | { state: 'loading' }
  | { state: 'success'; items: ApplicationSummary[] }
  | { state: 'error'; message: string }

type Tab = 'jd' | 'resume' | 'cover_letter'

type AutoApplyState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; prompt: string }
  | { state: 'error'; message: string }

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const pillClass =
  'rounded-full border border-(--border) bg-(--accent-soft) px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent) hover:text-(--surface)'

export function SavedTab({ onLoad }: { onLoad: (application: Application, tab: Tab) => void }) {
  const { demoMode } = useDemoMode()
  const [listState, setListState] = useState<ListState>(() => {
    if (demoMode) return { state: 'success', items: demoApplications }
    return process.env.NEXT_PUBLIC_API_URL
      ? { state: 'loading' }
      : { state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' }
  })
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const [autoApplyId, setAutoApplyId] = useState<string | null>(null)
  const [autoApplyUrl, setAutoApplyUrl] = useState('')
  const [autoApplyInstructions, setAutoApplyInstructions] = useState('')
  const [autoApplyState, setAutoApplyState] = useState<AutoApplyState>({ state: 'idle' })
  const [copied, setCopied] = useState(false)
  const autoApplyPopoverRef = useRef<HTMLDivElement>(null)

  function runFetch(apiUrl: string) {
    fetch(`${apiUrl}/applications`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text()
          throw new Error(`${res.status}: ${body}`)
        }
        return res.json()
      })
      .then((items: ApplicationSummary[]) => setListState({ state: 'success', items }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setListState({ state: 'error', message })
      })
  }

  useEffect(() => {
    // Demo mode initializes listState straight to 'success' with the fixture
    // data, so it's never 'loading' here — guarded explicitly anyway.
    if (demoMode) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) return
    runFetch(apiUrl)
    // demoMode never changes without a full page reload (see
    // DemoModeContext.tsx), so this only ever needs to run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoApplyId) return
    function handleClickOutside(e: MouseEvent) {
      if (autoApplyPopoverRef.current && !autoApplyPopoverRef.current.contains(e.target as Node)) {
        closeAutoApply()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [autoApplyId])

  function handleRetry() {
    // Defense in depth: listState is initialized straight to 'success' in
    // demo mode and never transitions to 'error', so the Retry button that
    // calls this is never actually rendered there.
    if (demoMode) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      setListState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      return
    }
    setListState({ state: 'loading' })
    runFetch(apiUrl)
  }

  async function handleOpen(id: string, tab: Tab) {
    if (demoMode) {
      onLoad(demoApplication, tab)
      return
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl || pendingId) return

    setPendingId(id)
    try {
      const res = await fetch(`${apiUrl}/applications/${id}`)
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }
      const application: Application = await res.json()
      onLoad(application, tab)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setListState({ state: 'error', message })
    } finally {
      setPendingId(null)
    }
  }

  async function handleDelete(id: string) {
    // Defense in depth: the Delete button itself isn't rendered in demo mode.
    if (demoMode) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) return

    setConfirmingId(null)
    setPendingId(id)
    try {
      const res = await fetch(`${apiUrl}/applications/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }
      setListState((prev) =>
        prev.state === 'success'
          ? { state: 'success', items: prev.items.filter((item) => item.id !== id) }
          : prev,
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setListState({ state: 'error', message })
    } finally {
      setPendingId(null)
    }
  }

  function openAutoApply(id: string) {
    if (demoMode) {
      showToast('Auto Apply is out of scope for this demo')
      return
    }
    setAutoApplyId(id)
    setAutoApplyUrl('')
    setAutoApplyInstructions('')
    setAutoApplyState({ state: 'idle' })
    setCopied(false)
  }

  function closeAutoApply() {
    setAutoApplyId(null)
  }

  async function handlePrepareApplication(id: string) {
    // Defense in depth: openAutoApply already blocks the popover with a
    // toast in demo mode, so this should be unreachable there.
    if (demoMode) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      setAutoApplyState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      return
    }
    if (!autoApplyUrl.trim()) return

    setAutoApplyState({ state: 'loading' })
    try {
      const res = await fetch(`${apiUrl}/applications/${id}`)
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }
      const application: Application = await res.json()
      const prompt = buildAutoApplyPrompt({
        application,
        url: autoApplyUrl.trim(),
        extraInstructions: autoApplyInstructions,
        apiUrl,
      })
      setAutoApplyState({ state: 'ready', prompt })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setAutoApplyState({ state: 'error', message })
    }
  }

  async function handleCopy() {
    if (autoApplyState.state !== 'ready') return
    try {
      await navigator.clipboard.writeText(autoApplyState.prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setAutoApplyState({ state: 'error', message: `Failed to copy: ${message}` })
    }
  }

  if (listState.state === 'loading') {
    return <p className='text-sm text-(--muted)'>Loading saved applications...</p>
  }

  if (listState.state === 'error') {
    return (
      <div className='flex flex-col gap-2'>
        <p className='font-medium text-(--danger)'>
          Error loading saved applications: {listState.message}
        </p>
        <button
          type='button'
          onClick={handleRetry}
          className='self-start rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft)'
        >
          Retry
        </button>
      </div>
    )
  }

  if (listState.items.length === 0) {
    return <p className='text-sm text-(--muted)'>No saved applications yet.</p>
  }

  return (
    <div className='flex flex-col gap-2'>
      {listState.items.map((item) => {
        const isPending = pendingId === item.id
        const isAutoApplyOpen = autoApplyId === item.id
        return (
          <div
            key={item.id}
            onClick={() => handleOpen(item.id, 'jd')}
            className={`flex items-center justify-between gap-2 rounded border border-(--border) bg-(--surface) p-3 transition-colors hover:cursor-pointer hover:border-b-2 hover:border-(--accent-hover)/60 ${
              isPending ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <div className='flex flex-col gap-1'>
              <span className='text-sm font-medium text-foreground'>{item.name}</span>
              <div className='flex flex-wrap items-center gap-1.5'>
                <button
                  type='button'
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpen(item.id, 'jd')
                  }}
                  className={pillClass}
                >
                  Job Description
                </button>
                {item.has_resume && (
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpen(item.id, 'resume')
                    }}
                    className={pillClass}
                  >
                    Resume
                  </button>
                )}
                {item.has_cover_letter && (
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpen(item.id, 'cover_letter')
                    }}
                    className={pillClass}
                  >
                    Cover Letter
                  </button>
                )}
              </div>
              <span className='text-xs text-(--muted)'>{formatDate(item.created_at)}</span>
            </div>
            <div
              className='flex items-center gap-2'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='relative'>
                <button
                  type='button'
                  onClick={() => openAutoApply(item.id)}
                  disabled={isPending}
                  className='rounded border border-(--accent) px-3 py-1.5 text-sm font-medium text-(--accent) transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
                >
                  Auto Apply
                </button>
                {isAutoApplyOpen && (
                  <div
                    ref={autoApplyPopoverRef}
                    className='absolute right-0 top-full z-20 mt-2 flex w-[32rem] max-w-[90vw] flex-col gap-3 rounded border border-(--border) bg-(--surface) p-4 shadow-lg'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-sm font-semibold text-foreground'>
                        Auto Apply — {item.name}
                      </span>
                      <button
                        type='button'
                        onClick={closeAutoApply}
                        aria-label='Close'
                        className='text-(--muted) hover:cursor-pointer hover:text-foreground'
                      >
                        ✕
                      </button>
                    </div>

                    {autoApplyState.state === 'ready' ? (
                      <>
                        <p className='text-xs text-(--muted)'>
                          Paste this into a separate Claude Code + Claude-in-Chrome session to fill
                          out the application. It will never auto-submit.
                        </p>
                        <textarea
                          readOnly
                          value={autoApplyState.prompt}
                          rows={12}
                          className='w-full resize-y rounded border border-(--border) bg-background p-2 font-mono text-xs text-foreground'
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                        <div className='flex justify-end'>
                          <button
                            type='button'
                            onClick={handleCopy}
                            className='rounded bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--surface) transition-colors hover:cursor-pointer hover:bg-(--accent-hover)'
                          >
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <label className='flex flex-col gap-1'>
                          <span className='text-xs font-medium text-foreground'>
                            Application form URL
                          </span>
                          <input
                            type='text'
                            value={autoApplyUrl}
                            onChange={(e) => setAutoApplyUrl(e.target.value)}
                            placeholder='https://...'
                            disabled={autoApplyState.state === 'loading'}
                            className='rounded border border-(--border) bg-background px-2 py-1 text-sm text-foreground'
                          />
                        </label>
                        <label className='flex flex-col gap-1'>
                          <span className='text-xs font-medium text-foreground'>
                            Extra instructions for this application (optional)
                          </span>
                          <textarea
                            value={autoApplyInstructions}
                            onChange={(e) => setAutoApplyInstructions(e.target.value)}
                            rows={3}
                            disabled={autoApplyState.state === 'loading'}
                            placeholder='e.g. answer the "why this company" question by mentioning...'
                            className='resize-none rounded border border-(--border) bg-background p-2 text-sm text-foreground'
                          />
                        </label>
                        {autoApplyState.state === 'error' && (
                          <p className='text-xs font-medium text-(--danger)'>
                            {autoApplyState.message}
                          </p>
                        )}
                        <div className='flex justify-end gap-2'>
                          <button
                            type='button'
                            onClick={closeAutoApply}
                            disabled={autoApplyState.state === 'loading'}
                            className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
                          >
                            Cancel
                          </button>
                          <button
                            type='button'
                            onClick={() => handlePrepareApplication(item.id)}
                            disabled={!autoApplyUrl.trim() || autoApplyState.state === 'loading'}
                            className='rounded bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--surface) transition-colors hover:cursor-pointer hover:bg-(--accent-hover) disabled:opacity-50'
                          >
                            {autoApplyState.state === 'loading' ? 'Preparing...' : 'Prepare Application'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {!demoMode &&
                (confirmingId === item.id ? (
                  <>
                    <span className='self-center text-xs text-(--muted)'>Delete this item?</span>
                    <button
                      type='button'
                      onClick={() => handleDelete(item.id)}
                      disabled={isPending}
                      className='rounded border border-(--danger) px-3 py-1.5 text-sm font-medium text-(--danger) transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
                    >
                      Confirm
                    </button>
                    <button
                      type='button'
                      onClick={() => setConfirmingId(null)}
                      disabled={isPending}
                      className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type='button'
                    onClick={() => setConfirmingId(item.id)}
                    disabled={isPending}
                    className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-(--danger) transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
                  >
                    Delete
                  </button>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
