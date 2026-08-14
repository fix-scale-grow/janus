'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useData } from '@/src/lib/data/provider'
import { useAuth } from '@/src/lib/auth'
import { useJanus } from '@/src/lib/janus-dock'
import { contactRepo, invoiceRepo, jobRepo, daysInStage } from '@/src/lib/data/repositories'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  currency,
  relativeTime,
  salesStageMeta,
  productionStageMeta,
  jobTypeLabels,
} from '@/src/lib/format'
import { AgentKindIcon } from '@/components/agent/agent-icon'
import {
  Sparkles,
  Send,
  Mic,
  Check,
  Pencil,
  X,
  ArrowRight,
  ArrowUpRight,
  ShieldAlert,
  Phone,
  DollarSign,
  Clock,
  TriangleAlert,
} from 'lucide-react'

export default function DashboardPage() {
  const { store, now, sendSuggestion, dismissSuggestion, resolveApproval } = useData()
  const { session } = useAuth()
  const { ask, openDock, setPrefill } = useJanus()

  const firstName = (session?.name ?? 'there').split(' ')[0]
  const hour = new Date(now).getHours()
  const partOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'

  // ---- Overnight recap, from what the agent actually did -------------------
  const recentActivity = store.agentActivity.slice(0, 16)
  const calls = recentActivity.filter((a) => a.kind === 'call').length
  const booked = recentActivity.filter((a) => a.kind === 'schedule').length
  const texts = recentActivity.filter((a) => a.kind === 'sms').length
  const nudgeContact = (() => {
    const sms = store.agentActivity.find((a) => a.kind === 'sms' && a.contactId)
    const c = sms ? contactRepo.byId(store, sms.contactId!) : undefined
    return c?.name.split(' ')[0]
  })()

  const openSuggestions = store.aiSuggestions.filter((s) => s.status === 'open')
  const pendingApprovals = store.agentApprovals.filter((a) => a.status === 'pending')
  const needsYou = openSuggestions.length + pendingApprovals.length

  const recap = useMemo(() => {
    const bits: string[] = []
    if (calls) bits.push(`answered ${calls} call${calls === 1 ? '' : 's'}`)
    if (booked) bits.push(booked === 1 ? 'booked an inspection' : `booked ${booked} inspections`)
    if (texts && nudgeContact) bits.push(`sent ${nudgeContact} a nudge`)
    else if (texts) bits.push(`sent ${texts} follow-up${texts === 1 ? '' : 's'}`)
    const joined =
      bits.length > 1 ? bits.slice(0, -1).join(', ') + ', and ' + bits[bits.length - 1] : bits[0] ?? 'kept things quiet'
    return `Overnight I ${joined}.`
  }, [calls, booked, texts, nudgeContact])

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
      <div className="space-y-6">
        {/* ---- Agent hero ---- */}
        <section>
          <div className="flex items-start gap-4">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-6 w-6" />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-success ring-2 ring-background" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-balance">
                {partOfDay}, {firstName}.
              </h1>
              <p className="mt-1 text-base leading-relaxed text-muted-foreground text-pretty">
                {recap}{' '}
                {needsYou > 0 ? (
                  <span className="font-medium text-foreground">
                    {needsYou} thing{needsYou === 1 ? '' : 's'} need{needsYou === 1 ? 's' : ''} you.
                  </span>
                ) : (
                  <span className="font-medium text-foreground">You&apos;re all caught up.</span>
                )}
              </p>
            </div>
          </div>
        </section>

        {/* ---- What's next queue ---- */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">What&apos;s next</h2>
            <span className="text-xs text-muted-foreground">Janus&apos;s proposed moves — one tap each</span>
          </div>

          <div className="space-y-3">
            {pendingApprovals.map((ap) => (
              <ApprovalCard
                key={ap.id}
                title={ap.title}
                reason={ap.reason}
                preview={ap.preview}
                onDo={() => resolveApproval(ap.id, 'approved')}
                onSkip={() => resolveApproval(ap.id, 'denied')}
              />
            ))}

            {openSuggestions.slice(0, 4).map((s) => {
              const job = store.jobs.find((j) => j.id === s.jobId)
              const contact = job ? contactRepo.byId(store, job.contactId) : undefined
              return (
                <NextCard
                  key={s.id}
                  proposal={s.recommendation}
                  context={`${contact?.name ?? 'Job'} · ${s.insight}`}
                  draft={s.draft}
                  confidence={s.confidence}
                  jobHref={job ? `/jobs/${job.id}` : undefined}
                  onDo={() => sendSuggestion(s.id)}
                  onEdit={
                    s.draft
                      ? () => {
                          setPrefill(s.draft!)
                          openDock()
                        }
                      : undefined
                  }
                  onSkip={() => dismissSuggestion(s.id)}
                />
              )
            })}

            {/* Eager last card — Janus wants more work */}
            <EagerCard onYes={() => ask('chase the overdue invoices while it is quiet')} />
          </div>
        </section>

        {/* ---- Composer: the primary control ---- */}
        <Composer onSend={(text) => ask(text)} />

        {/* ---- Reference material the agent draws on ---- */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ReferenceJobs />
          <ReferenceAttention />
        </section>

        {/* ---- Slim stat strip ---- */}
        <StatStrip />
      </div>
    </div>
  )
}

/* ------------------------------ Queue cards ------------------------------- */

function CardShell({ children }: { children: React.ReactNode }) {
  return <Card className="p-6">{children}</Card>
}

function NextCard({
  proposal,
  context,
  draft,
  confidence,
  jobHref,
  onDo,
  onEdit,
  onSkip,
}: {
  proposal: string
  context: string
  draft?: string
  confidence: number
  jobHref?: string
  onDo: () => void
  onEdit?: () => void
  onSkip: () => void
}) {
  const [done, setDone] = useState<null | 'done' | 'skipped'>(null)

  if (done) {
    return (
      <CardShell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {done === 'done' ? (
            <>
              <Check className="h-4 w-4 text-success" /> Done — Janus handled it.
            </>
          ) : (
            <>
              <X className="h-4 w-4" /> Skipped.
            </>
          )}
        </div>
      </CardShell>
    )
  }

  return (
    <CardShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground text-pretty">{proposal}</p>
            <p className="mt-1 text-xs text-muted-foreground text-pretty">{context}</p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {Math.round(confidence * 100)}%
          </span>
        </div>

        {draft && (
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Draft ready</p>
            <p className="text-sm leading-relaxed text-foreground text-pretty">{draft}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => { onDo(); setDone('done') }}>
            <Check className="mr-1.5 h-4 w-4" /> Do it
          </Button>
          {onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => { onSkip(); setDone('skipped') }}>
            Skip
          </Button>
          {jobHref && (
            <Link
              href={jobHref}
              className="ml-auto inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
            >
              Open job <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </CardShell>
  )
}

function ApprovalCard({
  title,
  reason,
  preview,
  onDo,
  onSkip,
}: {
  title: string
  reason: string
  preview: string
  onDo: () => void
  onSkip: () => void
}) {
  const [done, setDone] = useState<null | 'approved' | 'denied'>(null)

  if (done) {
    return (
      <Card className="border-warning/40 bg-warning/5 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {done === 'approved' ? (
            <>
              <Check className="h-4 w-4 text-success" /> Approved — on it now.
            </>
          ) : (
            <>
              <X className="h-4 w-4" /> Denied.
            </>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-warning/40 bg-warning/5 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground text-pretty">{title}</p>
            <p className="mt-1 text-xs text-warning-foreground/80 text-pretty">Needs approval — {reason}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Exactly what will happen
          </p>
          <p className="text-sm leading-relaxed text-foreground text-pretty">{preview}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { onDo(); setDone('approved') }}>
            <Check className="mr-1.5 h-4 w-4" /> Approve
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { onSkip(); setDone('denied') }}>
            Deny
          </Button>
        </div>
      </div>
    </Card>
  )
}

function EagerCard({ onYes }: { onYes: () => void }) {
  const [asked, setAsked] = useState(false)
  return (
    <Card className="border-dashed border-primary/40 bg-primary/5 p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground text-pretty">
            Want me to chase the three overdue invoices while it&apos;s quiet? I&apos;ll send payment links and log
            every message.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" onClick={() => { onYes(); setAsked(true) }}>
              Yes, go ahead
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsked(true)}>
              Not now
            </Button>
          </div>
          {asked && <p className="mt-3 text-xs text-muted-foreground">Got it — I&apos;ll keep an eye on things.</p>}
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------- Composer --------------------------------- */

function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  function startHold() {
    setListening(true)
  }
  function endHold() {
    if (!listening) return
    setListening(false)
    holdTimer.current = setTimeout(() => {
      setText('The Hendersons called — they want to move their inspection to Friday morning')
    }, 400)
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border bg-card p-3 shadow-sm focus-within:border-primary/50"
    >
      <div className="flex items-center gap-3">
        <Sparkles className="ml-1 h-5 w-5 shrink-0 text-primary" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell Janus what happened or what you need…"
          className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onMouseDown={startHold}
          onMouseUp={endHold}
          onMouseLeave={endHold}
          onTouchStart={(e) => { e.preventDefault(); startHold() }}
          onTouchEnd={(e) => { e.preventDefault(); endHold() }}
          aria-label="Hold to talk"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
            listening ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'
          }`}
        >
          <Mic className="h-5 w-5" />
        </button>
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send to Janus"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      {listening && (
        <p className="px-9 pt-2 text-xs text-muted-foreground">Listening… release to transcribe</p>
      )}
    </form>
  )
}

/* --------------------------- Reference material --------------------------- */

function ReferenceJobs() {
  const { store, now } = useData()
  const todays = jobRepo.todaysJobs(store, now)
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold">Today&apos;s jobs</h2>
        <Link href="/schedule" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Schedule <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {todays.length === 0 && <p className="px-6 py-6 text-sm text-muted-foreground">No jobs scheduled today.</p>}
        {todays.slice(0, 5).map((job) => {
          const contact = contactRepo.byId(store, job.contactId)
          const ps = job.productionStage ? productionStageMeta[job.productionStage] : null
          return (
            <div key={job.id} className="flex items-center gap-4 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{contact?.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {contact?.address}, {contact?.city}
                </p>
              </div>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{jobTypeLabels[job.jobType]}</span>
              {ps && (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium">
                  <span className="h-2 w-2 rounded-full" style={{ background: ps.dot }} />
                  {ps.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function ReferenceAttention() {
  const { store, now } = useData()
  const unansweredLeads = store.conversations.filter(
    (c) => c.unread && c.messages[c.messages.length - 1]?.direction === 'inbound',
  )
  const overdueInvoices = store.invoices.filter((i) => i.status === 'overdue')
  const stuckJobs = store.jobs.filter(
    (j) => j.salesStage !== 'approved' && j.salesStage !== 'lost' && daysInStage(j, now) > 7,
  )

  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b border-border px-6 py-4">
        <TriangleAlert className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">On Janus&apos;s radar</h2>
      </div>
      <div className="divide-y divide-border">
        {unansweredLeads.slice(0, 2).map((c) => (
          <AttentionRow key={c.id} href="/inbox" label={`Unanswered lead — ${c.displayName}`} meta={relativeTime(c.lastActivityAt, now)} tone="info" />
        ))}
        {overdueInvoices.slice(0, 2).map((inv) => {
          const contact = contactRepo.byId(store, inv.contactId)
          return (
            <AttentionRow key={inv.id} href="/invoices" label={`Overdue — ${contact?.name}`} meta={currency(invoiceRepo.balance(inv), true)} tone="danger" />
          )
        })}
        {stuckJobs.slice(0, 2).map((j) => {
          const contact = contactRepo.byId(store, j.contactId)
          return (
            <AttentionRow key={j.id} href="/sales" label={`Stuck ${daysInStage(j, now)}d — ${contact?.name}`} meta={salesStageMeta[j.salesStage].label} tone="warn" />
          )
        })}
      </div>
    </Card>
  )
}

function AttentionRow({
  href,
  label,
  meta,
  tone,
}: {
  href: string
  label: string
  meta: string
  tone: 'info' | 'danger' | 'warn'
}) {
  const dot = tone === 'danger' ? 'bg-destructive' : tone === 'warn' ? 'bg-primary' : 'bg-info'
  return (
    <Link href={href} className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-secondary/50">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{meta}</span>
    </Link>
  )
}

/* ------------------------------ Stat strip -------------------------------- */

function StatStrip() {
  const { store } = useData()
  const callsThisWeek = store.aiCalls.length + 5
  const stats = [
    { icon: <Phone className="h-4 w-4" />, label: 'Calls answered', value: String(callsThisWeek) },
    { icon: <DollarSign className="h-4 w-4" />, label: 'Revenue touched', value: currency(128400, true) },
    { icon: <Clock className="h-4 w-4" />, label: 'Hours saved', value: '37 hrs' },
    { icon: <AgentKindIcon kind="task" className="h-4 w-4" />, label: 'Actions this week', value: String(store.agentActivity.length + 24) },
  ]
  return (
    <Card className="flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-4">
      {stats.map((s, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{s.icon}</span>
          <div className="leading-tight">
            <p className="text-lg font-semibold tabular-nums text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        </div>
      ))}
      <Link href="/janus" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        Full activity ledger <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  )
}
