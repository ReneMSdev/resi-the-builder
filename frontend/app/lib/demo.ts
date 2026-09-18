import { Application, ApplicationSummary, Profile } from '../types'
import applicationFixture from './demoFixtures/application.json'
import applicationsFixture from './demoFixtures/applications.json'
import profileFixture from './demoFixtures/profile.json'

// Set only in Vercel's project settings for the portfolio-demo deployment.
// Local dev (.env.local) never sets this, so it always stays false there —
// demo mode is an explicit opt-in, never an accidental fallback.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export const demoApplication = applicationFixture as Application
export const demoApplications = applicationsFixture as ApplicationSummary[]
export const demoProfile = profileFixture as Profile

// Artificial delay so demo "Generate"/"Revise" actions still show their
// loading state instead of resolving instantly, which would read as broken
// rather than fast.
export function demoDelay(ms = 700): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
