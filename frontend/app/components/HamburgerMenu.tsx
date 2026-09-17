'use client'

import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Menu, X } from 'lucide-react'

export function HamburgerMenu({
  onSelect,
}: {
  onSelect: (view: 'saved' | 'profile') => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={setOpen}
      modal={false}
    >
      <DropdownMenu.Trigger asChild>
        <button
          type='button'
          aria-label='Menu'
          className='relative h-6 w-6 shrink-0 text-(--accent) transition-colors hover:cursor-pointer hover:text-(--accent-hover)'
        >
          <Menu
            className={`absolute inset-0 h-6 w-6 transition-all duration-200 ${
              open ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'
            }`}
          />
          <X
            className={`absolute inset-0 h-6 w-6 transition-all duration-200 ${
              open ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'
            }`}
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align='start'
          sideOffset={12}
          className='z-50 min-w-40 rounded border border-(--accent-hover) bg-(--accent) p-1 shadow-lg'
        >
          <DropdownMenu.Item
            onSelect={() => onSelect('profile')}
            className='rounded px-3 py-2 text-sm font-medium text-(--surface) outline-none transition-colors hover:cursor-pointer hover:bg-(--accent-hover) focus:bg-(--accent-hover)'
          >
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => onSelect('saved')}
            className='rounded px-3 py-2 text-sm font-medium text-(--surface) outline-none transition-colors hover:cursor-pointer hover:bg-(--accent-hover) focus:bg-(--accent-hover)'
          >
            Saved
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
