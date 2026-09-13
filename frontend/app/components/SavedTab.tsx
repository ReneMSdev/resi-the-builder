'use client'

import { useEffect, useState } from 'react'
import { SavedItem, SavedItemSummary } from '../types'

type ListState =
  | { state: 'loading' }
  | { state: 'success'; items: SavedItemSummary[] }
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

export function SavedTab({ onLoad }: { onLoad: (item: SavedItem) => void }) {
  const [listState, setListState] = useState<ListState>(() =>
    process.env.NEXT_PUBLIC_API_URL
      ? { state: 'loading' }
      : { state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' },
  )
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  function runFetch(apiUrl: string) {
    fetch(`${apiUrl}/resumes`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text()
          throw new Error(`${res.status}: ${body}`)
        }
        return res.json()
      })
      .then((items: SavedItemSummary[]) => setListState({ state: 'success', items }))
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

  async function handleLoad(id: string) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) return

    setPendingId(id)
    try {
      const res = await fetch(`${apiUrl}/resumes/${id}`)
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }
      const item: SavedItem = await res.json()
      onLoad(item)
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
      const res = await fetch(`${apiUrl}/resumes/${id}`, { method: 'DELETE' })
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
    return <p className='text-sm text-(--muted)'>Loading saved items...</p>
  }

  if (listState.state === 'error') {
    return (
      <div className='flex flex-col gap-2'>
        <p className='font-medium text-(--danger)'>Error loading saved items: {listState.message}</p>
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
    return <p className='text-sm text-(--muted)'>No saved items yet.</p>
  }

  return (
    <div className='flex flex-col gap-2'>
      {listState.items.map((item) => (
        <div
          key={item.id}
          className='flex items-center justify-between gap-2 rounded border border-(--border) bg-(--surface) p-3'
        >
          <div className='flex flex-col gap-1'>
            <div className='flex items-center gap-2'>
              <span className='text-sm font-medium text-foreground'>{item.name}</span>
              <span className='rounded bg-(--accent-soft) px-1.5 py-0.5 text-xs font-medium text-foreground'>
                {item.type === 'resume' ? 'Resume' : 'Cover Letter'}
              </span>
            </div>
            <span className='text-xs text-(--muted)'>{formatDate(item.created_at)}</span>
          </div>
          <div className='flex gap-2'>
            {confirmingId === item.id ? (
              <>
                <span className='self-center text-xs text-(--muted)'>Delete this item?</span>
                <button
                  type='button'
                  onClick={() => handleDelete(item.id)}
                  disabled={pendingId === item.id}
                  className='rounded border border-(--danger) px-3 py-1.5 text-sm font-medium text-(--danger) transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
                >
                  Confirm
                </button>
                <button
                  type='button'
                  onClick={() => setConfirmingId(null)}
                  disabled={pendingId === item.id}
                  className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type='button'
                  onClick={() => handleLoad(item.id)}
                  disabled={pendingId === item.id}
                  className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
                >
                  Load
                </button>
                <button
                  type='button'
                  onClick={() => setConfirmingId(item.id)}
                  disabled={pendingId === item.id}
                  className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-(--danger) transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
