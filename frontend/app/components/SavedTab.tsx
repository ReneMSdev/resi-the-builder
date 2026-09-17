'use client'

import { useEffect, useState } from 'react'
import { Application, ApplicationSummary } from '../types'

type ListState =
  | { state: 'loading' }
  | { state: 'success'; items: ApplicationSummary[] }
  | { state: 'error'; message: string }

type Tab = 'jd' | 'resume' | 'cover_letter'

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

export function SavedTab({
  onLoad,
}: {
  onLoad: (application: Application, tab: Tab) => void
}) {
  const [listState, setListState] = useState<ListState>(() =>
    process.env.NEXT_PUBLIC_API_URL
      ? { state: 'loading' }
      : { state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' },
  )
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) return
    runFetch(apiUrl)
  }, [])

  function handleRetry() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      setListState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      return
    }
    setListState({ state: 'loading' })
    runFetch(apiUrl)
  }

  async function handleOpen(id: string, tab: Tab) {
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

  if (listState.state === 'loading') {
    return <p className='text-sm text-(--muted)'>Loading saved applications...</p>
  }

  if (listState.state === 'error') {
    return (
      <div className='flex flex-col gap-2'>
        <p className='font-medium text-(--danger)'>Error loading saved applications: {listState.message}</p>
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
        return (
          <div
            key={item.id}
            onClick={() => handleOpen(item.id, 'jd')}
            className={`flex items-center justify-between gap-2 rounded border border-(--border) bg-(--surface) p-3 transition-colors hover:cursor-pointer hover:bg-(--accent-soft) ${
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
              className='flex gap-2'
              onClick={(e) => e.stopPropagation()}
            >
              {confirmingId === item.id ? (
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
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
