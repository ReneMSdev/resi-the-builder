'use client'

import { useEffect, useRef, useState } from 'react'

// Not an accurate estimate of remaining time — just a "still working, and
// getting closer" signal for long-running actions (Generate, Revise) that
// have no real progress events to report. Fills toward ASYMPTOTE_CAP over
// roughly `expectedDurationMs` using an exponential-approach curve, so it
// naturally slows down rather than stalling at a fixed percentage; the real
// completion (`active` going false) snaps it to 100% before it hides.
const ASYMPTOTE_CAP = 95
const UPDATE_INTERVAL_MS = 100
const HIDE_DELAY_MS = 400

export function ProgressBar({
  active,
  expectedDurationMs,
  className,
}: {
  active: boolean
  expectedDurationMs: number
  // Width + alignment, e.g. "mx-auto w-1/2" (centered, half the immediate
  // parent's width) or "w-full max-w-96" (left-aligned by default since
  // block elements start at the left without mx-auto, capped at a fixed
  // width). Each call site's surrounding layout determines what "half"
  // should actually be measured against, so this is required rather than
  // defaulted — the two current call sites already need different values.
  className: string
}) {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const wasActiveRef = useRef(false)

  useEffect(() => {
    if (active) {
      wasActiveRef.current = true
      const start = Date.now()
      // Resetting animation state to sync with an external prop transition
      // (active going true) — there's no way to derive this during render,
      // since it depends on starting a timer, not on existing state/props.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgress(0)
      setVisible(true)
      // Solve tau so the curve reaches ASYMPTOTE_CAP right at
      // expectedDurationMs: 100*(1-e^(-T/tau)) = CAP => tau = T / ln(100/(100-CAP)).
      const tau = expectedDurationMs / Math.log(100 / (100 - ASYMPTOTE_CAP))
      const interval = setInterval(() => {
        const elapsed = Date.now() - start
        setProgress(100 * (1 - Math.exp(-elapsed / tau)))
      }, UPDATE_INTERVAL_MS)
      return () => clearInterval(interval)
    }

    // Only snap-and-hide if this bar was actually showing something —
    // avoids running the hide timer pointlessly on initial mount, when
    // `active` starts false and nothing was ever in flight.
    if (!wasActiveRef.current) return
    wasActiveRef.current = false
    setProgress(100)
    const timeout = setTimeout(() => setVisible(false), HIDE_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [active, expectedDurationMs])

  return (
    // Fixed-height container always renders, so the space is reserved
    // whether or not the bar is currently visible — toggling opacity here
    // rather than conditionally mounting avoids the layout shift that
    // mounting/unmounting this element would otherwise cause.
    <div
      className={`h-2 overflow-hidden rounded-full bg-(--border) transition-opacity duration-300 ${className}`}
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
    >
      <div
        className="h-full rounded-full bg-(--accent) transition-[width] duration-150 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
