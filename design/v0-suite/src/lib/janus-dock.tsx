'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useData } from './data/provider'
import { askJanus, type AskResponse } from './ask-janus'

export type JanusTurn = { id: number; query: string; response: AskResponse }

interface JanusDockValue {
  open: boolean
  turns: JanusTurn[]
  /** A query staged from the composer that the panel should drop into its input. */
  prefill: string
  openDock: () => void
  closeDock: () => void
  toggleDock: () => void
  ask: (query: string) => void
  setPrefill: (v: string) => void
  clearThread: () => void
}

const JanusDockContext = createContext<JanusDockValue | null>(null)

export function JanusDockProvider({ children }: { children: ReactNode }) {
  const { store } = useData()
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<JanusTurn[]>([])
  const [prefill, setPrefill] = useState('')

  const openDock = useCallback(() => setOpen(true), [])
  const closeDock = useCallback(() => setOpen(false), [])
  const toggleDock = useCallback(() => setOpen((o) => !o), [])
  const clearThread = useCallback(() => setTurns([]), [])

  const ask = useCallback(
    (query: string) => {
      const q = query.trim()
      if (!q) return
      setTurns((prev) => [...prev, { id: Date.now(), query: q, response: askJanus(q, store) }])
      setOpen(true)
    },
    [store],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo<JanusDockValue>(
    () => ({ open, turns, prefill, openDock, closeDock, toggleDock, ask, setPrefill, clearThread }),
    [open, turns, prefill, openDock, closeDock, toggleDock, ask, clearThread],
  )

  return <JanusDockContext.Provider value={value}>{children}</JanusDockContext.Provider>
}

export function useJanus() {
  const ctx = useContext(JanusDockContext)
  if (!ctx) throw new Error('useJanus must be used within JanusDockProvider')
  return ctx
}
