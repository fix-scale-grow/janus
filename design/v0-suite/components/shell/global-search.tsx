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
} from 'lucide-react'
import { useData } from '@/src/lib/data/provider'
import { jobTypeLabels } from '@/src/lib/format'
import { askJanus, askSuggestions, type AskResponse, type ToolChip } from '@/src/lib/ask-janus'
import { cn } from '@/lib/utils'

type Result = { id: string; label: string; sub: string; href: string; icon: typeof Users }
type Turn = { id: number; query: string; response: AskResponse }

const chipIcons = {
  search: Search,
  message: MessageSquare,
  file: FileText,
  calendar: Calendar,
  phone: Phone,
  check: Check,
  user: Users,
}

export function GlobalSearch() {
  const { store } = useData()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20)
    else {
      setQ('')
      setTurns([])
    }
  }, [open])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  // Fast entity lookup — shown as the user types a short query.
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
        out.push({ id: j.id, label: j.title, sub: c?.city ?? '', href: j.won ? `/production?job=${j.id}` : `/sales?job=${j.id}`, icon: Briefcase })
      }
    }
    for (const e of store.estimates) {
      if (e.number.toLowerCase().includes(t)) out.push({ id: e.id, label: e.number, sub: 'Estimate', href: `/estimates/${e.id}`, icon: FileText })
    }
    for (const inv of store.invoices) {
      if (inv.number.toLowerCase().includes(t)) out.push({ id: inv.id, label: inv.number, sub: 'Invoice', href: `/invoices/${inv.id}`, icon: ReceiptText })
    }
    return out.slice(0, 6)
  }, [q, store])

  // Natural language = anything with a space and more than 2 words, or ends with "?"
  const looksLikeQuestion = (t: string) => t.trim().split(/\s+/).length >= 3 || t.trim().endsWith('?')

  function ask(query: string) {
    if (!query.trim()) return
    setTurns((prev) => [...prev, { id: Date.now(), query, response: askJanus(query, store) }])
    setQ('')
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (looksLikeQuestion(q) || turns.length > 0) ask(q)
    else if (results[0]) {
      router.push(results[0].href)
      setOpen(false)
    } else if (q.trim()) {
      ask(q)
    }
  }

  const showThread = turns.length > 0
  const showResults = !showThread && q && !looksLikeQuestion(q) && results.length > 0

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="flex-1 text-left">Ask Janus or search…</span>
        <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh]">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-foreground/30 backdrop-blur-[1px]" />
          <div className="relative flex max-h-[78vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl animate-in fade-in zoom-in-95">
            <form onSubmit={onSubmit} className="flex items-center gap-2 border-b border-border px-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={showThread ? 'Ask a follow-up…' : 'Ask Janus anything, or search customers & jobs…'}
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
                <CornerDownLeft className="h-3 w-3" /> Enter
              </kbd>
            </form>

            <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              {/* Conversation thread */}
              {showThread && (
                <div className="space-y-4 p-4">
                  {turns.map((t) => (
                    <ConversationTurn key={t.id} turn={t} onNavigate={(href) => { router.push(href); setOpen(false) }} />
                  ))}
                </div>
              )}

              {/* Entity results */}
              {showResults && (
                <div className="p-1.5">
                  {results.map((r) => {
                    const Icon = r.icon
                    return (
                      <button
                        key={r.href + r.id}
                        onClick={() => { router.push(r.href); setOpen(false) }}
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

              {/* Empty / suggestions state */}
              {!showThread && !showResults && (
                <div className="p-4">
                  <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Try asking Janus
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
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
                    <p className="mt-4 px-1 text-center text-sm text-muted-foreground">No matches for “{q}”.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ConversationTurn({ turn, onNavigate }: { turn: Turn; onNavigate: (href: string) => void }) {
  const { response } = turn
  return (
    <div className="space-y-2.5">
      {/* User bubble */}
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {turn.query}
        </p>
      </div>

      {/* Tool chips */}
      <div className="flex flex-wrap gap-1.5">
        {response.chips.map((c, i) => (
          <ToolChipView key={i} chip={c} />
        ))}
      </div>

      {/* Agent answer */}
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
          <button className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
            Edit
          </button>
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
