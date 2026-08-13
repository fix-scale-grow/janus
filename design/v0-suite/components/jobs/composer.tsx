'use client'

import { useState } from 'react'
import { useData } from '@/src/lib/data/provider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StickyNote, MessageSquare, Phone } from 'lucide-react'
import type { TimelineEntryKind } from '@/src/lib/data/types'

type Mode = Extract<TimelineEntryKind, 'note' | 'sms' | 'call'>

const TABS: { mode: Mode; label: string; icon: typeof StickyNote; placeholder: string }[] = [
  { mode: 'note', label: 'Note', icon: StickyNote, placeholder: 'Add an internal note…' },
  { mode: 'sms', label: 'Text', icon: MessageSquare, placeholder: 'Type an SMS to the customer…' },
  { mode: 'call', label: 'Log call', icon: Phone, placeholder: 'Notes from the call…' },
]

export function Composer({ jobId }: { jobId: string }) {
  const { addTimelineEntry } = useData()
  const [mode, setMode] = useState<Mode>('note')
  const [body, setBody] = useState('')

  const submit = () => {
    const text = body.trim()
    if (!text) return
    addTimelineEntry(jobId, mode, mode === 'sms' ? `Sent text: “${text}”` : text)
    setBody('')
  }

  const active = TABS.find((t) => t.mode === mode)!

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex gap-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.mode}
              onClick={() => setMode(t.mode)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                mode === t.mode ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={active.placeholder}
        rows={2}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">⌘+Enter to submit</span>
        <Button size="sm" onClick={submit} disabled={!body.trim()}>
          {mode === 'sms' ? 'Send text' : mode === 'call' ? 'Log call' : 'Add note'}
        </Button>
      </div>
    </div>
  )
}
