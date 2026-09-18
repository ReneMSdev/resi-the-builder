'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { BUILD_DEMO_MODE } from './demo'

type DemoModeContextValue = {
  demoMode: boolean
  toggle: () => void
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null)

const STORAGE_KEY = 'demoModeOverride'

function readInitialDemoMode(): boolean {
  // On the public demo build there is no override path at all — this
  // function returns true unconditionally and never touches localStorage,
  // so the override is structurally unreachable, not just defaulted off.
  if (BUILD_DEMO_MODE) return true
  // Server/build-time render (no window) always falls back to the build
  // default; only a real browser can have an override in localStorage.
  if (typeof window === 'undefined') return BUILD_DEMO_MODE
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    // localStorage unavailable (private browsing, blocked storage, etc.) —
    // fall through to the build default.
  }
  return BUILD_DEMO_MODE
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  // On the public demo build there's no override path, so the value is
  // final from the very first render (server and client always agree,
  // since readInitialDemoMode() short-circuits to true before ever touching
  // window) — render immediately, no mount gate needed.
  //
  // When an override is possible (BUILD_DEMO_MODE false), the value read
  // from localStorage can differ from what a static/SSR render produced
  // with no window — rendering children immediately in that case would
  // hydrate mismatched and force React to discard and rebuild the whole
  // tree client-side. Instead, children render only once mounted, so the
  // one render that depends on demoMode happens client-side from the start
  // with no server-rendered counterpart to mismatch against. This briefly
  // shows nothing (the plain --background color, not a white flash) rather
  // than a re-render — negligible for a synchronous localStorage read, and
  // it still avoids the race a useEffect-only correction would leave: every
  // descendant's own useState initializers only ever run once, so they must
  // see the resolved value on their first render, not a later one.
  const [mounted, setMounted] = useState(BUILD_DEMO_MODE)
  const [demoMode, setDemoMode] = useState(BUILD_DEMO_MODE)

  useEffect(() => {
    if (BUILD_DEMO_MODE) return
    // Syncing from an external system (localStorage) on mount, the one case
    // React's own docs call out as a legitimate use of setState-in-effect —
    // there's no way to read it before the first client render exists.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDemoMode(readInitialDemoMode())
    setMounted(true)
  }, [])

  function toggle() {
    // Structurally a no-op on the public demo build, matching
    // readInitialDemoMode's guarantee that this build never takes the
    // override branch.
    if (BUILD_DEMO_MODE) return
    try {
      window.localStorage.setItem(STORAGE_KEY, String(!demoMode))
    } catch {
      // If we can't persist the override, don't pretend the toggle worked.
      return
    }
    // Reload rather than flipping local state: this app's DEMO_MODE-gated
    // useState initializers and mount effects (profile fetch, resume/cover
    // letter state, etc.) only ever run once per page load, so a live
    // in-place flip would leave most of the app on the old mode until a
    // manual refresh anyway. A reload makes every consumer re-initialize
    // consistently from the new localStorage value in one step.
    window.location.reload()
  }

  if (!mounted) return null

  return (
    <DemoModeContext.Provider value={{ demoMode, toggle }}>{children}</DemoModeContext.Provider>
  )
}

export function useDemoMode(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext)
  if (!ctx) {
    throw new Error('useDemoMode must be used within a DemoModeProvider')
  }
  return ctx
}
