'use client'

import { useEffect, useRef, useState } from 'react'
import { Application, CoverLetter, JobDescription, Resume } from '../types'
import { SaveIcon } from './icons'
import { showToast } from './Toast'
import { useDemoMode } from '../lib/DemoModeContext'

type SaveState =
  | { state: 'idle' }
  | { state: 'prompting' }
  | { state: 'saving' }
  | { state: 'error'; message: string }

export function SaveButton({
  jobDescription,
  resume,
  coverLetter,
  applicationId,
  initialName,
  onSaved,
}: {
  jobDescription: JobDescription
  resume: Resume | null
  coverLetter: CoverLetter | null
  applicationId: string | null
  initialName: string
  onSaved: (application: Application) => void
}) {
  const { demoMode } = useDemoMode()
  const [saveState, setSaveState] = useState<SaveState>({ state: 'idle' })
  const [name, setName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const isOpen = saveState.state === 'prompting' || saveState.state === 'saving'
  const isUpdate = applicationId !== null

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSaveState((prev) => (prev.state === 'saving' ? prev : { state: 'idle' }))
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  async function handleConfirm() {
    // Defense in depth: the trigger button already short-circuits before the
    // popover ever opens in demo mode, so this should be unreachable — kept
    // as a second guard against ever hitting the network in demo mode.
    if (demoMode) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      setSaveState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      return
    }

    setSaveState({ state: 'saving' })

    try {
      const res = await fetch(
        isUpdate ? `${apiUrl}/applications/${applicationId}` : `${apiUrl}/applications`,
        {
          method: isUpdate ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim() || null,
            job_description: jobDescription,
            resume,
            cover_letter: coverLetter,
          }),
        },
      )

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      const application: Application = await res.json()

      setSaveState({ state: 'idle' })
      onSaved(application)
      showToast(isUpdate ? 'Updated!' : 'Saved!')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setSaveState({ state: 'error', message })
    }
  }

  return (
    <div
      ref={containerRef}
      className='relative flex items-center gap-2'
    >
      <button
        type='button'
        onClick={() => {
          if (demoMode) {
            showToast("Saving isn't available in this demo")
            return
          }
          setName(initialName)
          setSaveState({ state: 'prompting' })
        }}
        className='flex items-center gap-1.5 rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft)'
      >
        <SaveIcon className='h-4 w-4 shrink-0' />
        {isUpdate ? 'Update' : 'Save'}
      </button>
      {saveState.state === 'error' && (
        <span className='text-xs font-medium text-(--danger)'>Error saving: {saveState.message}</span>
      )}

      {isOpen && (
        <div className='absolute left-0 top-full z-20 mt-2 flex w-64 flex-col gap-2 rounded border border-(--border) bg-(--surface) p-3 shadow-lg'>
          <label className='flex flex-col gap-1'>
            <span className='text-xs font-medium text-foreground'>Name (optional)</span>
            <input
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Untitled application'
              autoFocus
              disabled={saveState.state === 'saving'}
              className='rounded border border-(--border) bg-background px-2 py-1 text-sm text-foreground'
            />
          </label>
          <div className='flex justify-end gap-2'>
            <button
              type='button'
              onClick={() => setSaveState({ state: 'idle' })}
              disabled={saveState.state === 'saving'}
              className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleConfirm}
              disabled={saveState.state === 'saving'}
              className='rounded bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--surface) transition-colors hover:bg-(--accent-hover) disabled:opacity-50 hover:cursor-pointer'
            >
              {saveState.state === 'saving' ? (isUpdate ? 'Updating...' : 'Saving...') : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
