'use client'

import { useEffect, useState } from 'react'

type ProfileState =
  | { state: 'loading' }
  | { state: 'success'; data: unknown }
  | { state: 'error'; message: string }

export function ProfileView() {
  const [profileState, setProfileState] = useState<ProfileState>(() =>
    process.env.NEXT_PUBLIC_API_URL
      ? { state: 'loading' }
      : { state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' },
  )

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) return

    fetch(`${apiUrl}/profile`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text()
          throw new Error(`${res.status}: ${body}`)
        }
        return res.json()
      })
      .then((data) => setProfileState({ state: 'success', data }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setProfileState({ state: 'error', message })
      })
  }, [])

  if (profileState.state === 'loading') {
    return <p className='text-sm text-(--muted)'>Loading profile...</p>
  }

  if (profileState.state === 'error') {
    return (
      <p className='font-medium text-(--danger)'>Error loading profile: {profileState.message}</p>
    )
  }

  return (
    <pre className='overflow-x-auto whitespace-pre-wrap rounded border border-(--border) bg-(--surface) p-3 text-xs text-foreground'>
      {JSON.stringify(profileState.data, null, 2)}
    </pre>
  )
}
