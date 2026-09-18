'use client'

import { useEffect, useState } from 'react'
import { Profile } from '../types'
import { ProfilePreview } from './ProfilePreview'
import { RevisionChat } from './RevisionChat'
import { showToast } from './Toast'
import {
  applyProfileRevisionUpdates,
  describeProfileSelection,
  addBullet,
  removeBullet,
  addSkillItem,
  removeSkillItem,
  editSkillItem,
  addLink,
  removeLink,
  editLink,
  addSummaryItem,
  removeSummaryItem,
} from '../lib/profile'

type PreviewMode = 'select' | 'edit'

type ProfileState =
  | { state: 'loading' }
  | { state: 'success'; profile: Profile }
  | { state: 'error'; message: string }

type ReviseState = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string }

type ApplyState =
  | { state: 'idle' }
  | { state: 'confirming' }
  | { state: 'applying' }
  | { state: 'error'; message: string }

const MAX_HISTORY = 10

function ModeToggle({
  mode,
  onChange,
}: {
  mode: PreviewMode
  onChange: (mode: PreviewMode) => void
}) {
  return (
    <div className='inline-flex overflow-hidden rounded border border-(--border)'>
      <button
        type='button'
        onClick={() => onChange('select')}
        className={`px-2 py-1 text-xs font-medium transition-colors hover:cursor-pointer ${
          mode === 'select'
            ? 'bg-(--accent) text-(--surface)'
            : 'bg-(--surface) text-foreground hover:bg-(--accent-soft)'
        }`}
      >
        Select
      </button>
      <button
        type='button'
        onClick={() => onChange('edit')}
        className={`px-2 py-1 text-xs font-medium transition-colors hover:cursor-pointer ${
          mode === 'edit'
            ? 'bg-(--edit) text-(--surface)'
            : 'bg-(--surface) text-foreground hover:bg-(--edit-soft)'
        }`}
      >
        Edit
      </button>
    </div>
  )
}

export function ProfileView() {
  const [profileState, setProfileState] = useState<ProfileState>(() =>
    process.env.NEXT_PUBLIC_API_URL
      ? { state: 'loading' }
      : { state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' },
  )
  const [previewMode, setPreviewMode] = useState<PreviewMode>('select')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reviseState, setReviseState] = useState<ReviseState>({ state: 'idle' })
  const [history, setHistory] = useState<Profile[]>([])
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [applyState, setApplyState] = useState<ApplyState>({ state: 'idle' })

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
      .then((profile: Profile) => setProfileState({ state: 'success', profile }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setProfileState({ state: 'error', message })
      })
  }, [])

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function pushHistory(profile: Profile) {
    setHistory((prev) => {
      const next = [...prev, profile]
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    })
  }

  function handleRevert() {
    if (history.length === 0) return
    const last = history[history.length - 1]
    setHistory(history.slice(0, -1))
    setProfileState({ state: 'success', profile: last })
  }

  function handleEditField(id: string, text: string) {
    if (profileState.state !== 'success') return
    pushHistory(profileState.profile)
    setProfileState({
      state: 'success',
      profile: applyProfileRevisionUpdates(profileState.profile, [{ id, text }]),
    })
  }

  function updateProfile(updater: (profile: Profile) => Profile) {
    if (profileState.state !== 'success') return
    pushHistory(profileState.profile)
    setProfileState({ state: 'success', profile: updater(profileState.profile) })
  }

  const handleAddBullet = (entryId: string, text: string) =>
    updateProfile((profile) => addBullet(profile, entryId, text))
  const handleRemoveBullet = (bulletId: string) =>
    updateProfile((profile) => removeBullet(profile, bulletId))
  const handleAddSkillItem = (groupId: string, text: string) =>
    updateProfile((profile) => addSkillItem(profile, groupId, text))
  const handleRemoveSkillItem = (groupId: string, itemId: string) =>
    updateProfile((profile) => removeSkillItem(profile, groupId, itemId))
  const handleEditSkillItem = (groupId: string, itemId: string, text: string) =>
    updateProfile((profile) => editSkillItem(profile, groupId, itemId, text))
  const handleAddLink = (label: string, url: string) =>
    updateProfile((profile) => addLink(profile, label, url))
  const handleRemoveLink = (linkId: string) =>
    updateProfile((profile) => removeLink(profile, linkId))
  const handleEditLink = (linkId: string, label: string, url: string) =>
    updateProfile((profile) => editLink(profile, linkId, label, url))
  const handleAddSummaryItem = (groupId: string, text: string) =>
    updateProfile((profile) => addSummaryItem(profile, groupId, text))
  const handleRemoveSummaryItem = (groupId: string, itemId: string) =>
    updateProfile((profile) => removeSummaryItem(profile, groupId, itemId))

  async function handleRevise(instruction: string) {
    if (profileState.state !== 'success') return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      setReviseState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      return
    }

    setReviseState({ state: 'loading' })

    try {
      const res = await fetch(`${apiUrl}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_ids: Array.from(selectedIds),
          instruction,
          profile: profileState.profile,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      const data: { updates: { id: string; text: string }[] } = await res.json()

      if (data.updates.length > 0) {
        pushHistory(profileState.profile)
        setProfileState({
          state: 'success',
          profile: applyProfileRevisionUpdates(profileState.profile, data.updates),
        })
      }
      setReviseState({ state: 'idle' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setReviseState({ state: 'error', message })
    }
  }

  async function handleApplyConfirm() {
    if (profileState.state !== 'success') return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) {
      setApplyState({ state: 'error', message: 'NEXT_PUBLIC_API_URL is not set.' })
      return
    }

    setApplyState({ state: 'applying' })

    try {
      const res = await fetch(`${apiUrl}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileState.profile),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      setHistory([])
      setApplyState({ state: 'idle' })
      showToast('Applied to profile!')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setApplyState({ state: 'error', message })
    }
  }

  if (profileState.state === 'loading') {
    return <p className='text-sm text-(--muted)'>Loading profile...</p>
  }

  if (profileState.state === 'error') {
    return (
      <p className='font-medium text-(--danger)'>Error loading profile: {profileState.message}</p>
    )
  }

  const { profile } = profileState
  const isApplyOpen = applyState.state === 'confirming' || applyState.state === 'applying'

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-xs text-(--muted)'>
          {previewMode === 'edit'
            ? 'Edit mode: click any field to edit it.'
            : selectedIds.size === 0
              ? 'Click a section, entry, bullet, or field to select it.'
              : `Selected: ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`}
        </p>
        <div className='relative flex items-center gap-2'>
          <ModeToggle
            mode={previewMode}
            onChange={setPreviewMode}
          />
          <button
            type='button'
            onClick={() => setApplyState({ state: 'confirming' })}
            className='rounded bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--surface) transition-colors hover:cursor-pointer hover:bg-(--accent-hover)'
          >
            Apply to Profile
          </button>
          {applyState.state === 'error' && (
            <span className='text-xs font-medium text-(--danger)'>
              Error applying: {applyState.message}
            </span>
          )}
          {isApplyOpen && (
            <div className='absolute right-0 top-full z-20 mt-2 flex w-72 flex-col gap-2 rounded border border-(--border) bg-(--surface) p-3 shadow-lg'>
              <p className='text-sm text-foreground'>
                Overwrite your master profile with these changes?
              </p>
              <div className='flex justify-end gap-2'>
                <button
                  type='button'
                  onClick={() => setApplyState({ state: 'idle' })}
                  disabled={applyState.state === 'applying'}
                  className='rounded border border-(--border) px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:cursor-pointer hover:bg-(--accent-soft) disabled:opacity-50'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={handleApplyConfirm}
                  disabled={applyState.state === 'applying'}
                  className='rounded bg-(--accent) px-3 py-1.5 text-sm font-medium text-(--surface) transition-colors hover:bg-(--accent-hover) disabled:opacity-50 hover:cursor-pointer'
                >
                  {applyState.state === 'applying' ? 'Applying...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProfilePreview
        profile={profile}
        selectedIds={selectedIds}
        onToggle={toggleSelected}
        mode={previewMode}
        openIds={openIds}
        onToggleOpen={toggleOpen}
        onEditField={handleEditField}
        onAddBullet={handleAddBullet}
        onRemoveBullet={handleRemoveBullet}
        onAddSkillItem={handleAddSkillItem}
        onRemoveSkillItem={handleRemoveSkillItem}
        onEditSkillItem={handleEditSkillItem}
        onAddLink={handleAddLink}
        onRemoveLink={handleRemoveLink}
        onEditLink={handleEditLink}
        onAddSummaryItem={handleAddSummaryItem}
        onRemoveSummaryItem={handleRemoveSummaryItem}
      />

      <details className='text-xs text-(--muted)'>
        <summary className='cursor-pointer select-none'>Raw JSON</summary>
        <pre className='mt-2 overflow-x-auto whitespace-pre-wrap'>
          {JSON.stringify(profile, null, 2)}
        </pre>
      </details>

      <RevisionChat
        selectionSummary={describeProfileSelection(profile, selectedIds)}
        selectionCount={selectedIds.size}
        loading={reviseState.state === 'loading'}
        errorMessage={reviseState.state === 'error' ? reviseState.message : null}
        onSubmit={handleRevise}
        canRevert={history.length > 0}
        onRevert={handleRevert}
      />
    </div>
  )
}
