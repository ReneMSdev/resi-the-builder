import type { ReactNode } from 'react'

// Explains what the real (non-demo) app can do on this tab, since the demo
// deliberately runs on canned data with no live AI — this is portfolio
// framing ("here's the real ceiling"), distinct from RevisionChat's
// how-to-use-this-demo banner. Rendered only when demoMode (from
// useDemoMode()) is true, by each call site — this component doesn't check
// it itself, so it stays reusable if a non-demo caller ever wants it.
export function DemoCapabilityBanner({ message }: { message: ReactNode }) {
  return (
    <div className='mb-3 rounded border border-(--success) bg-(--success)/10 px-3 py-2 text-sm text-(--success)'>
      {message}
    </div>
  )
}
