'use client'

import { useTimeline } from '@/src/lib/data/provider'
import { relativeTime, longDateTime, duration, callOutcomeMeta } from '@/src/lib/format'
import type { TimelineEntry } from '@/src/lib/data/types'
import { cn } from '@/lib/utils'
import { MessageSquare, Phone, StickyNote, GitBranch, Bot, FileText, Receipt } from 'lucide-react'

const ICONS = {
  note: StickyNote,
  call: Phone,
  sms: MessageSquare,
  system: GitBranch,
  stage_change: GitBranch,
  estimate: FileText,
  invoice: Receipt,
} as const

function isSystemEntry(e: TimelineEntry) {
  return e.kind === 'system' || e.kind === 'stage_change' || e.authorId === 'system'
}

export function Timeline({ jobId, entries: entriesProp }: { jobId?: string; entries?: TimelineEntry[] }) {
  const fetched = useTimeline(jobId ?? '')
  const entries = entriesProp ?? fetched

  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <ol className="flex flex-col">
      {sorted.map((e, i) => {
        const ai = e.authorId === 'ai'
        const Icon = ai ? Bot : ICONS[e.kind] ?? StickyNote
        const system = isSystemEntry(e)
        const outcome = e.meta?.outcome ? callOutcomeMeta[e.meta.outcome] : null
        return (
          <li key={e.id} className="relative flex gap-3 pb-4">
            {i < sorted.length - 1 && (
              <span className="absolute left-4 top-8 h-full w-px bg-border" aria-hidden />
            )}
            <div
              className={cn(
                'z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card',
                ai
                  ? 'bg-primary/15 text-primary'
                  : system
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-accent text-primary',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-foreground">
                  {ai ? 'AI Receptionist' : e.authorName}
                </span>
                {ai && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    AI
                  </span>
                )}
                {outcome && (
                  <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', outcome.className)}>
                    {outcome.label}
                  </span>
                )}
                <span className="text-xs text-muted-foreground" title={longDateTime(e.createdAt)}>
                  {relativeTime(e.createdAt)}
                </span>
              </div>
              <p
                className={cn(
                  'mt-0.5 whitespace-pre-wrap text-sm leading-relaxed',
                  system ? 'italic text-muted-foreground' : 'text-foreground/90',
                )}
              >
                {e.body}
              </p>
              {e.meta?.durationSec != null && (
                <p className="mt-0.5 text-xs text-muted-foreground">Call duration {duration(e.meta.durationSec)}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
