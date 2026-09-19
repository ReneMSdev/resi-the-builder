'use client'

import { useState } from 'react'
import { CoverLetter, Resume } from '../types'
import { DownloadIcon } from './icons'
import { useDemoMode } from '../lib/DemoModeContext'
import { showToast } from './Toast'

type DownloadState =
  | { state: 'idle' }
  | { state: 'loading'; format: 'docx' | 'pdf' }
  | { state: 'error'; message: string }

export function DownloadButtons({
  document: doc,
}: {
  document: { resume: Resume } | { coverLetter: CoverLetter }
}) {
  const { demoMode } = useDemoMode()
  const [downloadState, setDownloadState] = useState<DownloadState>({
    state: 'idle',
  })

  async function handleDownload(format: 'docx' | 'pdf') {
    if (demoMode) {
      // Matches Save/Update and Auto-Apply-Prepare's existing "not in scope
      // for this demo" treatment — stays clickable rather than disabled,
      // just doesn't do anything real.
      showToast("Downloading isn't available in this demo")
      return
    }

    setDownloadState({ state: 'loading', format })

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) {
        throw new Error('NEXT_PUBLIC_API_URL is not set.')
      }
      const res = await fetch(`${apiUrl}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          'resume' in doc
            ? { resume: doc.resume, format }
            : { cover_letter: doc.coverLetter, format },
        ),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="?([^";]+)"?/)
      const filename = match ? match[1] : `document.${format}`

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setDownloadState({ state: 'idle' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setDownloadState({ state: 'error', message })
    }
  }

  const isLoading = downloadState.state === 'loading'

  return (
    <div className='flex flex-col gap-1'>
      <div className='flex gap-2'>
        <button
          type='button'
          onClick={() => handleDownload('docx')}
          disabled={isLoading}
          className='flex items-center gap-1.5 rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
        >
          <DownloadIcon className='h-4 w-4 shrink-0' />
          {downloadState.state === 'loading' && downloadState.format === 'docx'
            ? 'Downloading...'
            : '.docx'}
        </button>
        <button
          type='button'
          onClick={() => handleDownload('pdf')}
          disabled={isLoading}
          className='flex items-center gap-1.5 rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
        >
          <DownloadIcon className='h-4 w-4 shrink-0' />
          {downloadState.state === 'loading' && downloadState.format === 'pdf'
            ? 'Downloading...'
            : '.pdf'}
        </button>
      </div>
      {downloadState.state === 'error' && (
        <p className='text-xs font-medium text-(--danger)'>
          Error downloading: {downloadState.message}
        </p>
      )}
    </div>
  )
}
