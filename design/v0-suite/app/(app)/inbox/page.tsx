'use client'

import { useMemo, useState } from 'react'
import {
  Phone,
  PhoneMissed,
  Play,
  Bot,
  Link2,
  Send,
  MessageSquare,
  ChevronLeft,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { useData, useAiCalls } from '@/src/lib/data/provider'
import { relativeTime, longDateTime, duration, callOutcomeMeta, urgencyTone } from '@/src/lib/format'
import type { Conversation, Message, AiCall } from '@/src/lib/data/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Sparkles, MapPin, AlertTriangle, CheckCircle2, UserCheck } from 'lucide-react'

export default function InboxPage() {
  const { store, linkConversation, markConversationRead } = useData()
  const aiCalls = useAiCalls()
  const convos = [...store.conversations].sort((a, b) =>
    a.lastActivityAt < b.lastActivityAt ? 1 : -1,
  )
  const normalizePhone = (p: string) => p.replace(/\D/g, '').slice(-10)
  const [selectedId, setSelectedId] = useState<string | null>(convos[0]?.id ?? null)
  const [draft, setDraft] = useState('')
  const [linkingId, setLinkingId] = useState<string | null>(null)

  const unmatched = convos.filter((c) => !c.contactId)
  const selected = convos.find((c) => c.id === selectedId) ?? null

  const initials = (name: string) =>
    name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  const openConversation = (c: Conversation) => {
    setSelectedId(c.id)
    if (c.unread) markConversationRead(c.id)
  }

  return (
    <div>
      <PageHeader title="Inbox" description={`${unmatched.length} unmatched · ${convos.length} conversations`} />

      {/* Unmatched triage strip */}
      {unmatched.length > 0 && (
        <div className="border-b border-border bg-warning/10 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-warning-foreground/80">
              Unmatched numbers
            </span>
            {unmatched.map((c) => (
              <UnmatchedChip
                key={c.id}
                convo={c}
                contacts={store.contacts}
                open={linkingId === c.id}
                onToggle={() => setLinkingId(linkingId === c.id ? null : c.id)}
                onLink={(contactId) => {
                  linkConversation(c.id, contactId)
                  setLinkingId(null)
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid h-[calc(100vh-8.5rem)] grid-cols-1 md:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <aside
          className={cn(
            'overflow-y-auto border-r border-border scrollbar-thin',
            selected && 'hidden md:block',
          )}
        >
          {convos.map((c) => {
            const last = c.messages[c.messages.length - 1]
            const active = c.id === selectedId
            return (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className={cn(
                  'flex w-full items-start gap-3 border-b border-border p-3 text-left transition-colors hover:bg-muted/50',
                  active && 'bg-accent/50',
                )}
              >
                <Avatar initials={c.contactId ? initials(c.displayName) : '#'} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('truncate text-sm', c.unread ? 'font-bold text-foreground' : 'font-medium text-foreground')}>
                      {c.displayName}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(c.lastActivityAt)}</span>
                  </div>
                  <p className={cn('flex items-center gap-1 truncate text-xs', c.unread ? 'text-foreground' : 'text-muted-foreground')}>
                    {last?.kind === 'call' ? (
                      <Phone className="h-3 w-3 shrink-0" />
                    ) : (
                      <MessageSquare className="h-3 w-3 shrink-0" />
                    )}
                    {last?.kind === 'call' ? `Call · ${duration(last.durationSec)}` : last?.body}
                  </p>
                </div>
                {c.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </button>
            )
          })}
        </aside>

        {/* Thread pane */}
        <section className={cn('flex flex-col overflow-hidden', !selected && 'hidden md:flex')}>
          {selected ? (
            <>
              <header className="flex items-center gap-3 border-b border-border p-3">
                <button className="md:hidden" onClick={() => setSelectedId(null)} aria-label="Back to list">
                  <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                </button>
                <Avatar initials={selected.contactId ? initials(selected.displayName) : '#'} size="md" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected.displayName}</p>
                  <p className="text-xs text-muted-foreground">{selected.phone}</p>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
                {(() => {
                  const aiCall = aiCalls.find(
                    (c) => normalizePhone(c.phone) === normalizePhone(selected.phone),
                  )
                  return aiCall ? <AiCallCard call={aiCall} /> : null
                })()}
                {selected.messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </div>

              <div className="border-t border-border p-3">
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setDraft('')
                  }}
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type an SMS…"
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function AiCallCard({ call }: { call: AiCall }) {
  const [takenOver, setTakenOver] = useState(false)
  const urgencyToneVal = urgencyTone(call.extracted.urgency)
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Answered by Janus</p>
            <p className="text-[11px] text-muted-foreground">
              {relativeTime(call.at)} · {duration(call.durationSec)} · {Math.round(call.confidence * 100)}% confidence
            </p>
          </div>
        </div>
        <Badge variant={call.outcome === 'booked' ? 'success' : call.outcome === 'transferred' ? 'info' : 'secondary'}>
          {call.outcome}
        </Badge>
      </div>

      {/* Extracted fields */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name" value={call.extracted.name} />
        <Field
          label="Urgency"
          value={call.extracted.urgency}
          tone={urgencyToneVal}
          icon={call.extracted.urgency === 'emergency' ? <AlertTriangle className="h-3 w-3" /> : undefined}
        />
        <div className="col-span-2">
          <Field label="Address" value={call.extracted.address} icon={<MapPin className="h-3 w-3" />} />
        </div>
        <div className="col-span-2">
          <Field label="Issue" value={call.extracted.issue} />
        </div>
      </div>

      {/* What the agent did */}
      <div className="mt-3 border-t border-primary/20 pt-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What Janus did</p>
        <div className="flex flex-wrap gap-1.5">
          {call.actionsTaken.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success-foreground"
            >
              <CheckCircle2 className="h-3 w-3 text-success" /> {a}
            </span>
          ))}
        </div>
      </div>

      {/* Transcript */}
      <details className="mt-3 border-t border-primary/20 pt-3">
        <summary className="cursor-pointer text-xs font-medium text-primary">View transcript</summary>
        <div className="mt-2 space-y-1.5">
          {call.transcript.map((t, i) => (
            <p key={i} className="text-xs leading-relaxed">
              <span className="font-semibold text-foreground">
                {t.speaker === 'agent' ? 'Janus' : call.callerName.split(' ')[0]}:
              </span>{' '}
              <span className="text-foreground/80">{t.text}</span>
            </p>
          ))}
        </div>
      </details>

      <div className="mt-3">
        <Button
          size="sm"
          variant={takenOver ? 'outline' : 'default'}
          className="w-full"
          onClick={() => setTakenOver(true)}
          disabled={takenOver}
        >
          <UserCheck className="mr-1.5 h-4 w-4" />
          {takenOver ? 'You have the thread' : 'Take over thread'}
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: string
  tone?: 'warning' | 'info' | 'muted'
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-card p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'flex items-center gap-1 text-sm capitalize text-foreground',
          tone === 'warning' && 'text-warning-foreground',
          tone === 'info' && 'text-info-foreground',
        )}
      >
        {icon}
        {value}
      </p>
    </div>
  )
}

function MessageBubble({ message: m }: { message: Message }) {
  const outbound = m.direction === 'outbound'

  if (m.kind === 'call') {
    const outcome = m.outcome ? callOutcomeMeta[m.outcome] : null
    return (
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          {m.outcome === 'missed' ? (
            <PhoneMissed className="h-4 w-4 text-destructive" />
          ) : (
            <Phone className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground">
            {m.direction === 'inbound' ? 'Inbound call' : 'Outbound call'}
          </span>
          {m.durationSec != null && (
            <span className="text-xs text-muted-foreground">· {duration(m.durationSec)}</span>
          )}
          {outcome && (
            <span className={cn('ml-auto rounded border px-1.5 py-0.5 text-[10px] font-semibold', outcome.className)}>
              {outcome.label}
            </span>
          )}
        </div>

        {/* Recording player placeholder */}
        {m.durationSec ? (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
            <button className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label="Play recording">
              <Play className="h-3 w-3" />
            </button>
            <div className="h-1 flex-1 rounded-full bg-border">
              <div className="h-1 w-0 rounded-full bg-primary" />
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">{duration(m.durationSec)}</span>
          </div>
        ) : null}

        {/* AI transcript */}
        {m.aiHandled && m.transcript && (
          <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Bot className="h-3.5 w-3.5" /> AI Receptionist transcript
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/80">{m.transcript}</pre>
          </div>
        )}
        <p className="mt-1.5 text-right text-[11px] text-muted-foreground">{longDateTime(m.createdAt)}</p>
      </div>
    )
  }

  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[75%] rounded-2xl px-3.5 py-2', outbound ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
        <p className="text-sm leading-relaxed">{m.body}</p>
        <p className={cn('mt-0.5 text-[10px]', outbound ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {relativeTime(m.createdAt)}
        </p>
      </div>
    </div>
  )
}

function UnmatchedChip({
  convo,
  contacts,
  open,
  onToggle,
  onLink,
}: {
  convo: Conversation
  contacts: { id: string; name: string; phone: string }[]
  open: boolean
  onToggle: () => void
  onLink: (contactId: string) => void
}) {
  const [q, setQ] = useState('')
  const results = useMemo(
    () => contacts.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6),
    [contacts, q],
  )
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40"
      >
        {convo.displayName}
        <Link2 className="h-3 w-3 text-primary" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Link to contact…" className="mb-1.5 h-8" autoFocus />
          <ul className="max-h-48 overflow-y-auto scrollbar-thin">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onLink(c.id)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                >
                  {c.name}
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
