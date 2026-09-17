'use client'

import { useEffect, useState } from 'react'

type ToastVariant = 'success' | 'error'

type ToastMessage = {
  id: string
  text: string
  variant: ToastVariant
}

let toasts: ToastMessage[] = []
let listeners: ((toasts: ToastMessage[]) => void)[] = []

function notify() {
  for (const listener of listeners) listener(toasts)
}

export function showToast(text: string, variant: ToastVariant = 'success', duration = 2500) {
  const id = crypto.randomUUID()
  toasts = [...toasts, { id, text, variant }]
  notify()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  }, duration)
}

const variantClass: Record<ToastVariant, string> = {
  success: 'bg-(--success) text-(--surface)',
  error: 'bg-(--danger) text-(--surface)',
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastMessage[]>(toasts)

  useEffect(() => {
    listeners.push(setItems)
    return () => {
      listeners = listeners.filter((l) => l !== setItems)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className='pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2'>
      {items.map((toast) => (
        <div
          key={toast.id}
          className={`rounded px-3 py-2 text-sm font-medium shadow-lg ${variantClass[toast.variant]}`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  )
}
