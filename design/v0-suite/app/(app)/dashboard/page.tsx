'use client'

import { useData } from '@/src/lib/data/provider'
import {
  jobRepo,
  contactRepo,
  invoiceRepo,
  pipelineByStage,
  revenueThisWeekVsLast,
  weeklyRevenueSeries,
  daysInStage,
  conversationRepo,
} from '@/src/lib/data/repositories'
import { PageHeader } from '@/components/shell/app-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { MiniBarChart } from '@/components/ui/bar-chart'
import {
  currency,
  relativeTime,
  shortDate,
  salesStageMeta,
  productionStageMeta,
  jobTypeLabels,
  callOutcomeMeta,
} from '@/src/lib/format'
import { TrendingUp, TrendingDown, TriangleAlert, Phone, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { store, now } = useData()

  const todays = jobRepo.todaysJobs(store, now)
  const { thisWeek, lastWeek } = revenueThisWeekVsLast(store, now)
  const revSeries = weeklyRevenueSeries(store)
  const pipeline = pipelineByStage(store)
  const pipelineTotal = pipeline.reduce((s, p) => s + p.value, 0)
  const revDelta = lastWeek === 0 ? 0 : Math.round(((thisWeek - lastWeek) / lastWeek) * 100)

  // Needs attention
  const unansweredLeads = store.conversations.filter(
    (c) => c.unread && c.messages[c.messages.length - 1]?.direction === 'inbound',
  )
  const overdueInvoices = store.invoices.filter((i) => i.status === 'overdue')
  const stuckJobs = store.jobs.filter(
    (j) => j.salesStage !== 'approved' && j.salesStage !== 'lost' && daysInStage(j, now) > 7,
  )

  const aiCalls = store.receptionistCalls

  return (
    <div className="space-y-6">
      <PageHeader
        title="Good morning, Summit Ridge"
        description={new Date(now).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Revenue this week" value={currency(thisWeek, true)}>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              revDelta >= 0 ? 'text-success' : 'text-destructive'
            }`}
          >
            {revDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(revDelta)}% vs last week
          </span>
        </KpiCard>
        <KpiCard label="Pipeline value" value={currency(pipelineTotal, true)}>
          <span className="text-xs text-muted-foreground">{pipeline.reduce((s, p) => s + p.count, 0)} open jobs</span>
        </KpiCard>
        <KpiCard label="Jobs today" value={String(todays.length)}>
          <span className="text-xs text-muted-foreground">{store.jobs.filter((j) => j.won).length} in production</span>
        </KpiCard>
        <KpiCard label="Needs attention" value={String(unansweredLeads.length + overdueInvoices.length + stuckJobs.length)}>
          <span className="text-xs text-destructive">{overdueInvoices.length} overdue invoices</span>
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left/main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Today's jobs */}
          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Today&apos;s jobs</h2>
              <Link href="/schedule" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View schedule <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {todays.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">No jobs scheduled today.</p>}
              {todays.map((job) => {
                const contact = contactRepo.byId(store, job.contactId)
                const ps = job.productionStage ? productionStageMeta[job.productionStage] : null
                return (
                  <div key={job.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{contact?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{contact?.address}, {contact?.city}</p>
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{jobTypeLabels[job.jobType]}</span>
                    <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                      {job.crewName ?? 'Unassigned'}
                    </span>
                    {ps && (
                      <span className="hidden shrink-0 items-center gap-1.5 text-xs font-medium sm:inline-flex">
                        <span className="h-2 w-2 rounded-full" style={{ background: ps.dot }} />
                        {ps.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Revenue chart */}
          <Card>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-sm font-semibold">Revenue trend</h2>
                <p className="text-xs text-muted-foreground">Trailing 6 weeks</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums">{currency(thisWeek, true)}</p>
                <p className="text-xs text-muted-foreground">this week</p>
              </div>
            </div>
            <MiniBarChart data={revSeries} />
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Pipeline by stage */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold">Pipeline by stage</h2>
            <div className="space-y-3">
              {pipeline.map((p) => {
                const meta = salesStageMeta[p.stage]
                const pct = pipelineTotal ? Math.round((p.value / pipelineTotal) * 100) : 0
                return (
                  <div key={p.stage}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
                        {meta.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {p.count} · {currency(p.value, true)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.dot }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Needs attention */}
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <TriangleAlert className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Needs attention</h2>
            </div>
            <div className="divide-y divide-border">
              {unansweredLeads.slice(0, 3).map((c) => (
                <AttentionRow
                  key={c.id}
                  href="/inbox"
                  label={`Unanswered lead — ${c.displayName}`}
                  meta={relativeTime(c.lastActivityAt, now)}
                  tone="info"
                />
              ))}
              {overdueInvoices.slice(0, 3).map((inv) => {
                const contact = contactRepo.byId(store, inv.contactId)
                return (
                  <AttentionRow
                    key={inv.id}
                    href="/invoices"
                    label={`Overdue — ${contact?.name}`}
                    meta={currency(invoiceRepo.balance(inv), true)}
                    tone="danger"
                  />
                )
              })}
              {stuckJobs.slice(0, 3).map((j) => {
                const contact = contactRepo.byId(store, j.contactId)
                return (
                  <AttentionRow
                    key={j.id}
                    href="/sales"
                    label={`Stuck ${daysInStage(j, now)}d — ${contact?.name}`}
                    meta={salesStageMeta[j.salesStage].label}
                    tone="warn"
                  />
                )
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* AI Receptionist activity */}
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Phone className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold">AI Receptionist activity</h2>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Live
          </span>
        </div>
        <div className="divide-y divide-border">
          {aiCalls.map((call) => {
            const meta = callOutcomeMeta[call.outcome]
            return (
              <div key={call.id} className="flex items-center gap-4 px-5 py-3.5">
                <Avatar
            initials={call.callerName
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')}
            size="md"
          />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{call.callerName}</p>
                  <p className="truncate text-xs text-muted-foreground">{call.summary}</p>
                </div>
                <span className="hidden shrink-0 text-xs text-muted-foreground md:block">{call.phone}</span>
                <Badge className={meta.className}>{meta.label}</Badge>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(call.at, now)}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function KpiCard({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <div className="mt-1.5">{children}</div>
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
    <Link href={href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/50">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{meta}</span>
    </Link>
  )
}
