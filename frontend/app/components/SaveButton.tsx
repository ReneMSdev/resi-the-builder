'use client'

import { useState } from 'react'
import { CoverLetter, Resume } from '../types'

type SaveState =
  | { state: 'idle' }
  | { state: 'prompting' }
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'error'; message: string }

export function SaveButton({
  type,
  document: doc,
}: {
  type: 'resume' | 'cover_letter'
  document: Resume | CoverLetter
}) {
  const [saveState, setSaveState] = useState<SaveState>({ state: 'idle' })
  const [name, setName] = useState('')

  async function handleConfirm() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      setSaveState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      return
    }

    setSaveState({ state: 'saving' })

    try {
      const res = await fetch(`${apiUrl}/resumes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, data: doc }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      setName('')
      setSaveState({ state: 'saved' })
      setTimeout(() => {
        setSaveState((prev) => (prev.state === 'saved' ? { state: 'idle' } : prev))
      }, 2000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setSaveState({ state: 'error', message })
    }
  }

  if (saveState.state === 'prompting' || saveState.state === 'saving') {
    return (
      <div className='flex items-center gap-2'>
        <input
          type='text'
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Name (optional)'
          autoFocus
          disabled={saveState.state === 'saving'}
          className='rounded border border-(--border) bg-(--surface) px-2 py-1 text-sm text-foreground'
        />
        <button
          type='button'
          onClick={handleConfirm}
          disabled={saveState.state === 'saving'}
          className='rounded bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--surface) transition-colors hover:bg-(--accent-hover) disabled:opacity-50 hover:cursor-pointer'
        >
          {saveState.state === 'saving' ? 'Saving...' : 'Confirm'}
        </button>
        <button
          type='button'
          onClick={() => setSaveState({ state: 'idle' })}
          disabled={saveState.state === 'saving'}
          className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className='flex items-center gap-2'>
      <button
        type='button'
        onClick={() => setSaveState({ state: 'prompting' })}
        className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft)'
      >
        Save
      </button>
      {saveState.state === 'saved' && (
        <span className='text-xs font-medium text-(--success)'>Saved!</span>
      )}
      {saveState.state === 'error' && (
        <span className='text-xs font-medium text-(--danger)'>Error saving: {saveState.message}</span>
      )}
    </div>
  )
}
