'use client'

import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Sheet({
  open,
  onClose,
  children,
  className,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  labelledBy?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[1px] animate-in fade-in"
      />
      <div
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-[520px] bg-card shadow-2xl',
          'flex flex-col animate-in slide-in-from-right duration-200',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
