import { useState } from 'react'

// The first thing a demo visitor sees, above the tab row on every tab —
// orients them to what the real app does before they hit any of the
// per-tab DemoCapabilityBanner instances. Dismissible for this page load
// only (no persistence): a fresh visit should show it again.
export function DemoIntroBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className='relative mb-6 rounded border border-(--accent) bg-(--accent-soft) px-4 py-3 pr-9 text-sm text-foreground'>
      <p>
        <strong>Welcome to the demo.</strong> This app uses AI (Claude) to
        write a resume and cover letter tailored to a job description, then
        speeds up applying with <strong>Auto Apply</strong>, which fills out
        the job application for you — you always review and submit it
        yourself. Open the menu for <strong>Profile</strong>, the data
        supplied to the AI so it can make meaningful edits, and{' '}
        <strong>Saved</strong>, where you manage multiple job-application
        packages and access Auto Apply.
      </p>
      <button
        type='button'
        onClick={() => setDismissed(true)}
        aria-label='Dismiss'
        className='absolute right-2 top-2 rounded px-1.5 py-0.5 text-base leading-none text-(--muted) transition-colors hover:cursor-pointer hover:bg-black/5 hover:text-foreground'
      >
        ×
      </button>
    </div>
  )
}
