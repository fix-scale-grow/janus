'use client'

import { Sparkles } from 'lucide-react'
import { useJanus } from '@/src/lib/janus-dock'

export function GlobalSearch() {
  const { openDock } = useJanus()

  return (
    <button
      onClick={openDock}
      className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
    >
      <Sparkles className="h-4 w-4 text-primary" />
      <span className="flex-1 text-left">Ask Janus or search…</span>
      <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] sm:inline">⌘K</kbd>
    </button>
  )
}
