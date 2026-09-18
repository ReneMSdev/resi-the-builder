'use client'

import { useState } from 'react'
import { CoverLetter, Resume } from '../types'
import { DownloadIcon } from './icons'
import { DEMO_MODE } from '../lib/demo'

type DownloadState =
  | { state: 'idle' }
  | { state: 'loading'; format: 'docx' | 'pdf' }
  | { state: 'error'; message: string }

export function DownloadButtons({
  document: doc,
}: {
  document: { resume: Resume } | { coverLetter: CoverLetter }
}) {
  const [downloadState, setDownloadState] = useState<DownloadState>({
    state: 'idle',
  })

  async function handleDownload(format: 'docx' | 'pdf') {
    setDownloadState({ state: 'loading', format })

    try {
      let res: Response
      let filename: string

      if (DEMO_MODE) {
        // Static assets served by Next.js itself (same origin, /public), not
        // the backend — real pre-rendered files, never a /render POST.
        const kind = 'resume' in doc ? 'resume' : 'cover_letter'
        res = await fetch(`/demo/${kind}.${format}`)
        if (!res.ok) {
          throw new Error(`${res.status}: could not load demo ${kind}.${format}`)
        }
        filename = `${kind}.${format}`
      } else {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL
        if (!apiUrl) {
          throw new Error('NEXT_PUBLIC_API_URL is not set.')
        }
        res = await fetch(`${apiUrl}/render`, {
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
        filename = match ? match[1] : `document.${format}`
      }

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
          className='flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:cursor-pointer hover:bg-[var(--accent-soft)] disabled:opacity-50'
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
          className='flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:cursor-pointer hover:bg-[var(--accent-soft)] disabled:opacity-50'
        >
          <DownloadIcon className='h-4 w-4 shrink-0' />
          {downloadState.state === 'loading' && downloadState.format === 'pdf'
            ? 'Downloading...'
            : '.pdf'}
        </button>
      </div>
      {downloadState.state === 'error' && (
        <p className='text-xs font-medium text-[var(--danger)]'>
          Error downloading: {downloadState.message}
        </p>
      )}
    </div>
  )
}
