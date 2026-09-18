'use client'

import { BUILD_DEMO_MODE } from '../lib/demo'
import { useDemoMode } from '../lib/DemoModeContext'

// A dev-only convenience for previewing demo mode without a separate
// production build, and for a curious visitor to see what "Live" looks like.
// The BUILD_DEMO_MODE check happens here too, not just inside the context —
// on the public demo build this returns null outright, so the toggle never
// exists in the DOM at all, regardless of what useDemoMode() would report.
export function DemoModeToggle() {
  if (BUILD_DEMO_MODE) return null

  return <DemoModeToggleButton />
}

function DemoModeToggleButton() {
  const { demoMode, toggle } = useDemoMode()

  return (
    <button
      type='button'
      onClick={toggle}
      title={demoMode ? 'Switch to Live mode (real backend)' : 'Switch to Demo mode (canned data)'}
      // bottom-20 (not bottom-4) to clear ToastContainer's toast stack, which
      // anchors at bottom-4 right-4 and grows upward — and right- rather
      // than left-side, since Next's own dev-mode indicator badge occupies
      // bottom-left during `next dev` (production builds never show it, but
      // local dev is this toggle's main use case).
      className='fixed bottom-20 right-4 z-50 rounded-full border border-(--border) bg-(--surface) px-3 py-1.5 text-xs font-medium text-(--muted) shadow transition-colors hover:cursor-pointer hover:bg-(--accent-soft) hover:text-foreground'
    >
      {demoMode ? 'Demo' : 'Live'} mode
    </button>
  )
}
