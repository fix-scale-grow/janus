'use client'

import { useState } from 'react'
import { Sparkles, Send, Pencil, X, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { useAiSuggestions, useData } from '@/src/lib/data/provider'
import { suggestionKindMeta } from '@/src/lib/format'

const toneToVariant = {
  info: 'info',
  warning: 'warning',
  success: 'success',
  accent: 'default',
} as const

export function JobCopilot({ jobId, compact = false }: { jobId: string; compact?: boolean }) {
  const suggestions = useAiSuggestions(jobId).filter((s) => s.status === 'open')
  const { sendSuggestion, dismissSuggestion } = useData()

  if (suggestions.length === 0) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {suggestions.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          onSend={() => sendSuggestion(s.id)}
          onDismiss={() => dismissSuggestion(s.id)}
          compact={compact}
        />
      ))}
    </div>
  )
}

function SuggestionCard({
  suggestion,
  onSend,
  onDismiss,
  compact,
}: {
  suggestion: ReturnType<typeof useAiSuggestions>[number]
  onSend: () => void
  onDismiss: () => void
  compact: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(suggestion.draft ?? '')
  const meta = suggestionKindMeta[suggestion.kind]

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-semibold text-foreground">Janus copilot</span>
        <Badge variant={toneToVariant[meta.tone]} className="ml-auto">
          {meta.label}
        </Badge>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-foreground text-pretty">{suggestion.insight}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">
        {suggestion.recommendation}
      </p>

      {suggestion.draft && (
        <div className="mt-2.5">
          {editing ? (
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={compact ? 3 : 4} />
          ) : (
            <div className="rounded-md border border-border bg-card p-2.5">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Draft ready
              </p>
              <p className="text-xs leading-relaxed text-foreground text-pretty">{draft}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        {suggestion.draft ? (
          <Button size="sm" onClick={onSend}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Send
          </Button>
        ) : (
          <Button size="sm" onClick={onSend}>
            <Check className="mr-1.5 h-3.5 w-3.5" /> Do it
          </Button>
        )}
        {suggestion.draft && (
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> {editing ? 'Done' : 'Edit'}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDismiss} className="ml-auto text-muted-foreground">
          <X className="mr-1 h-3.5 w-3.5" /> Dismiss
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Confidence {Math.round(suggestion.confidence * 100)}%
      </p>
    </div>
  )
}
