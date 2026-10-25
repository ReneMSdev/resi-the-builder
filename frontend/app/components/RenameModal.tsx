'use client'

import { useEffect, useRef, useState } from 'react'
import { ApplicationSummary } from '../types'
import { APPLICATION_NAME_MAX, renameApplication } from '../lib/api'
import { useDemoMode } from '../lib/DemoModeContext'
import { showToast } from './Toast'

// Rename dialog for a saved application. Callers only mount it when renaming is
// allowed (demo mode shows a toast instead); handleConfirm re-checks as a backup.
export function RenameModal({
  applicationId,
  currentName,
  onClose,
  onRenamed,
}: {
  applicationId: string
  currentName: string
  onClose: () => void
  onRenamed: (summary: ApplicationSummary) => void
}) {
  const { demoMode } = useDemoMode()
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Whatever had focus when the dialog opened (the name button). Captured during the
  // first render, before the input's autoFocus moves focus, and restored on close.
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )

  // After a failed rename the input is enabled again; put the cursor back in it.
  useEffect(() => {
    if (error) inputRef.current?.focus()
  }, [error])

  async function handleConfirm() {
    if (demoMode || saving) return
    setSaving(true)
    // The input and buttons are disabled while saving; keep focus on the dialog so
    // Escape/Tab handling still applies instead of focus falling to the page behind.
    dialogRef.current?.focus()
    setError(null)
    try {
      const summary = await renameApplication(applicationId, name)
      onRenamed(summary)
      showToast('Renamed!')
      close()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  function close() {
    opener?.focus()
    onClose()
  }

  function cancel() {
    if (!saving) close()
  }

  function handleDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    // Keep Tab focus inside the dialog.
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('input, button'),
    ).filter((el) => !el.hasAttribute('disabled'))
    if (focusable.length === 0) {
      e.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      onClick={(e) => {
        e.stopPropagation()
        cancel()
      }}
    >
      <div
        ref={dialogRef}
        role='dialog'
        tabIndex={-1}
        aria-modal='true'
        aria-labelledby='rename-modal-title'
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        className='flex w-96 max-w-full flex-col gap-3 rounded border border-(--border) bg-(--surface) p-4 shadow-lg outline-none'
      >
        <h2 id='rename-modal-title' className='text-sm font-semibold text-foreground'>
          Rename application
        </h2>
        <input
          ref={inputRef}
          type='text'
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleConfirm()
            }
          }}
          maxLength={APPLICATION_NAME_MAX}
          placeholder='Leave blank for the automatic name'
          autoFocus
          onFocus={(e) => e.target.select()}
          disabled={saving}
          aria-label='Application name'
          className='rounded border border-(--border) bg-background px-2 py-1 text-sm text-foreground'
        />
        {error && <p className='text-xs font-medium text-(--danger)'>Error renaming: {error}</p>}
        <div className='flex justify-end gap-2'>
          <button
            type='button'
            onClick={cancel}
            disabled={saving}
            className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={saving}
            className='rounded bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--surface) transition-colors hover:cursor-pointer hover:bg-(--accent-hover) disabled:opacity-50'
          >
            {saving ? 'Renaming...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
