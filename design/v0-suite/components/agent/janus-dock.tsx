'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Users,
  FileText,
  ReceiptText,
  Briefcase,
  Sparkles,
  MessageSquare,
  Calendar,
  Phone,
  Check,
  CornerDownLeft,
  Send,
  ArrowUpRight,
  ChevronDown,
} from 'lucide-react'
import { useData } from '@/src/lib/data/provider'
import { useJanus, type JanusTurn } from '@/src/lib/janus-dock'
import { jobTypeLabels } from '@/src/lib/format'
import { askSuggestions, type AskResponse, type ToolChip } from '@/src/lib/ask-janus'

type Result = { id: string; label: string; sub: string; href: string; icon: typeof Users }

const chipIcons = {
  search: Search,
  message: MessageSquare,
  file: FileText,
  calendar: Calendar,
  phone: Phone,
  check: Check,
  user: Users,
}

export function JanusDock() {
  const { store } = useData()
  const { open, turns, prefill, openDock, closeDock, ask, setPrefill } = useJanus()
  const router = useRouter()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  // Live status shown on the pill.
  const draftsReady = store.aiSuggestions.filter((s) => s.status === 'open' && s.draft).length
  const pendingApprovals = store.agentApprovals.filter((a) => a.status === 'pending').length
  const status =
    pendingApprovals > 0
      ? `${pendingApprovals} need${pendingApprovals === 1 ? 's' : ''} you · ${draftsReady} drafts ready`
      : `watching the inbox · ${draftsReady} drafts ready`

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20)
  }, [open])

  // Consume a composer prefill when the dock opens.
  useEffect(() => {
    if (open && prefill) {
      setQ(prefill)
      setPrefill('')
    }
  }, [open, prefill, setPrefill])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  const results = useMemo<Result[]>(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    const out: Result[] = []
    for (const c of store.contacts) {
      if (c.name.toLowerCase().includes(t) || c.address.toLowerCase().includes(t) || c.phone.includes(t)) {
        out.push({ id: c.id, label: c.name, sub: `${c.address}, ${c.city}`, href: `/contacts/${c.id}`, icon: Users })
      }
    }
    for (const j of store.jobs) {
      const c = store.contacts.find((x) => x.id === j.contactId)
      if (j.title.toLowerCase().includes(t) || jobTypeLabels[j.jobType].toLowerCase().includes(t)) {
        out.push({
          id: j.id,
          label: j.title,
          sub: c?.city ?? '',
          href: j.won ? `/production?job=${j.id}` : `/sales?job=${j.id}`,
          icon: Briefcase,
        })
      }
    }
    for (const e of store.estimates) {
      if (e.number.toLowerCase().includes(t))
        out.push({ id: e.id, label: e.number, sub: 'Estimate', href: `/estimates/${e.id}`, icon: FileText })
    }
    for (const inv of store.invoices) {
      if (inv.number.toLowerCase().includes(t))
        out.push({ id: inv.id, label: inv.number, sub: 'Invoice', href: `/invoices/${inv.id}`, icon: ReceiptText })
    }
    return out.slice(0, 6)
  }, [q, store])

  const looksLikeQuestion = (t: string) => t.trim().split(/\s+/).length >= 3 || t.trim().endsWith('?')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (looksLikeQuestion(q) || turns.length > 0) {
      ask(q)
      setQ('')
    } else if (results[0]) {
      router.push(results[0].href)
      closeDock()
    } else if (q.trim()) {
      ask(q)
      setQ('')
    }
  }

  function navigate(href: string) {
    router.push(href)
    closeDock()
  }

  const showThread = turns.length > 0
  const showResults = !showThread && q && !looksLikeQuestion(q) && results.length > 0

  return (
    <>
      {/* Persistent pill */}
      {!open && (
        <button
          onClick={openDock}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-primary/30 bg-popover/95 py-2 pl-2 pr-4 shadow-lg backdrop-blur transition-all hover:shadow-xl"
          aria-label="Open Janus"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-popover" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-sm font-semibold text-foreground">Janus</span>
            <span className="text-[11px] text-muted-foreground">{status}</span>
          </span>
        </button>
      )}

      {/* Expandable conversation panel */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6">
          {/* mobile backdrop */}
          <button
            aria-label="Close Janus"
            onClick={closeDock}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-[1px] sm:hidden"
          />
          <div className="relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-popover shadow-2xl animate-in slide-in-from-bottom-4 sm:h-[560px] sm:max-h-[80vh] sm:w-[420px] sm:rounded-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-popover" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-sm font-semibold text-foreground">Janus</p>
                <p className="truncate text-[11px] text-muted-foreground">{status}</p>
              </div>
              <button
                onClick={closeDock}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Minimize"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              {showThread && (
                <div className="space-y-4 p-4">
                  {turns.map((t) => (
                    <ConversationTurn key={t.id} turn={t} onNavigate={navigate} />
                  ))}
                </div>
              )}

              {showResults && (
                <div className="p-2">
                  {results.map((r) => {
                    const Icon = r.icon
                    return (
                      <button
                        key={r.href + r.id}
                        onClick={() => navigate(r.href)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {!showThread && !showResults && (
                <div className="p-4">
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm leading-relaxed text-foreground text-pretty">
                      I&apos;m keeping an eye on things. Ask me anything, or tell me what happened and I&apos;ll take it
                      from there.
                    </p>
                  </div>
                  <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Try asking
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {askSuggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="flex-1">{s}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                  {q && !looksLikeQuestion(q) && (
                    <p className="mt-4 px-1 text-center text-sm text-muted-foreground">No matches for &ldquo;{q}&rdquo;.</p>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={submit} className="flex items-center gap-2 border-t border-border px-3 py-2.5">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={showThread ? 'Ask a follow-up…' : 'Ask Janus, or search…'}
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!q.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function ConversationTurn({ turn, onNavigate }: { turn: JanusTurn; onNavigate: (href: string) => void }) {
  const { response } = turn
  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {turn.query}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {response.chips.map((c, i) => (
          <ToolChipView key={i} chip={c} />
        ))}
      </div>

      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm leading-relaxed text-foreground text-pretty">{response.answer}</p>
          {response.result && <ResultView result={response.result} onNavigate={onNavigate} />}
        </div>
      </div>
    </div>
  )
}

function ToolChipView({ chip }: { chip: ToolChip }) {
  const Icon = chipIcons[chip.icon]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" />
      {chip.label}
    </span>
  )
}

function ResultView({ result, onNavigate }: { result: AskResponse['result']; onNavigate: (href: string) => void }) {
  if (!result || result.kind === 'note') return null

  if (result.kind === 'jobs') {
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        {result.items.map((it) => (
          <button
            key={it.id}
            onClick={() => onNavigate(it.href)}
            className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{it.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{it.sub}</span>
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    )
  }

  if (result.kind === 'draft') {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Draft {result.channel === 'sms' ? 'text' : 'email'} to {result.to}
        </p>
        <p className="text-sm leading-relaxed text-foreground text-pretty">{result.body}</p>
        <div className="mt-2.5 flex gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            <Send className="h-3.5 w-3.5" /> Send
          </button>
          <button className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">Edit</button>
        </div>
      </div>
    )
  }

  if (result.kind === 'estimate') {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{result.number}</p>
          <p className="text-sm font-semibold text-primary">{result.total}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{result.note}</p>
        <div className="mt-2.5 flex gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            <FileText className="h-3.5 w-3.5" /> Open draft
          </button>
          <button className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
            Review pricing
          </button>
        </div>
      </div>
    )
  }

  return null
}
