'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Phone,
  DollarSign,
  Clock,
  ShieldAlert,
  Check,
  X,
  Undo2,
  ArrowUpRight,
} from 'lucide-react'
import { PageHeader } from '@/components/shell/app-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AgentKindIcon } from '@/components/agent/agent-icon'
import {
  useAgentActivity,
  useAgentApprovals,
  useAiCalls,
  useData,
} from '@/src/lib/data/provider'
import { currency, relativeTime, longDateTime } from '@/src/lib/format'

export default function JanusPage() {
  const activity = useAgentActivity()
  const approvals = useAgentApprovals()
  const aiCalls = useAiCalls()
  const { resolveApproval, revertAgentActivity } = useData()

  const pending = approvals.filter((a) => a.status === 'pending')

  const stats = useMemo(() => {
    const callsThisWeek = aiCalls.length + 5
    const revenueTouched = 128400
    const hoursSaved = 37
    return { callsThisWeek, revenueTouched, hoursSaved }
  }, [aiCalls])

  return (
    <div>
      <PageHeader
        title="Janus AI"
        description="Your AI office staff — here's everything it handled and anything that needs your call."
      />

      <div className="space-y-6 p-4 md:p-6">
        {/* Waiting on you */}
        {pending.length > 0 && (
          <section aria-labelledby="waiting-heading">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" />
              <h2 id="waiting-heading" className="text-sm font-semibold text-foreground">
                Waiting on you
              </h2>
              <Badge variant="warning">{pending.length}</Badge>
              <span className="text-xs text-muted-foreground">
                Only high-impact actions pause for approval. Everything else already shipped.
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {pending.map((ap) => (
                <Card key={ap.id} className="flex flex-col gap-3 border-warning/40 bg-warning/5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground text-pretty">{ap.title}</p>
                      <p className="mt-0.5 text-xs text-warning-foreground/80">{ap.reason}</p>
                    </div>
                    {ap.amount ? (
                      <Badge variant="warning" className="shrink-0">
                        {currency(ap.amount)}
                      </Badge>
                    ) : ap.recipients ? (
                      <Badge variant="warning" className="shrink-0">
                        {ap.recipients} people
                      </Badge>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-border bg-card p-3">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Exactly what will happen
                    </p>
                    <p className="text-xs leading-relaxed text-foreground">{ap.preview}</p>
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => resolveApproval(ap.id, 'approved')}>
                      <Check className="mr-1.5 h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => resolveApproval(ap.id, 'denied')}
                    >
                      <X className="mr-1.5 h-4 w-4" /> Deny
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Stats row */}
        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<Phone className="h-4 w-4" />}
            label="Calls answered this week"
            value={String(stats.callsThisWeek)}
            sub="Zero missed after hours"
          />
          <StatCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Revenue the AI touched"
            value={currency(stats.revenueTouched)}
            sub="Booked, quoted, or collected"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Hours saved (est.)"
            value={`${stats.hoursSaved} hrs`}
            sub="Across calls, texts, and admin"
          />
        </section>

        {/* Today feed */}
        <section aria-labelledby="today-heading">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 id="today-heading" className="text-sm font-semibold text-foreground">
              Today
            </h2>
            <span className="text-xs text-muted-foreground">Everything Janus did, newest first</span>
          </div>

          <ol className="relative space-y-3 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-border">
            {activity.map((a) => (
              <li key={a.id} className="relative flex gap-3">
                <div
                  className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                    a.reverted ? 'border-border bg-muted text-muted-foreground' : 'border-primary/30 bg-primary/10 text-primary'
                  }`}
                >
                  <AgentKindIcon kind={a.kind} className="h-4 w-4" />
                </div>
                <Card className="flex-1 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium text-pretty ${
                          a.reverted ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}
                      >
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground" title={longDateTime(a.at)}>
                        {relativeTime(a.at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {a.jobId && (
                        <Link
                          href={`/jobs/${a.jobId}`}
                          className="inline-flex items-center gap-0.5 rounded px-1.5 py-1 text-xs text-primary hover:bg-primary/10"
                        >
                          Job <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      )}
                      {a.revertable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revertAgentActivity(a.id)}
                          className="h-7 px-2 text-xs"
                        >
                          <Undo2 className="mr-1 h-3.5 w-3.5" />
                          {a.reverted ? 'Redo' : 'Revert'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {a.evidence && !a.reverted && (
                    <div className="mt-2.5 rounded-md border border-border bg-muted/40 p-2.5">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {a.evidence.label}
                      </p>
                      <p className="text-xs leading-relaxed text-foreground text-pretty">{a.evidence.body}</p>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  )
}
