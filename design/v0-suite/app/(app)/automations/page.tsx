'use client'

import { useMemo, useState } from 'react'
import { Sparkles, Zap, ArrowRightLeft, MessageSquare, Mail, CheckSquare, Bell, CheckCircle2, MinusCircle, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/shell/app-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs } from '@/components/ui/tabs'
import { useData, useAutomations, useAutomationRuns } from '@/src/lib/data/provider'
import { parseAutomation } from '@/src/lib/automation-parser'
import { relativeTime } from '@/src/lib/format'
import type { AutomationActionKind, AutomationAutonomy } from '@/src/lib/data/types'
import { cn } from '@/lib/utils'

const actionIcon: Record<AutomationActionKind, typeof MessageSquare> = {
  sms: MessageSquare,
  email: Mail,
  task: CheckSquare,
  stage: ArrowRightLeft,
  notify: Bell,
}

const autonomyMeta: Record<AutomationAutonomy, { label: string; hint: string; className: string }> = {
  auto: { label: 'Auto-run', hint: 'Ships automatically, no approval needed', className: 'bg-info/10 text-info' },
  auto_logged: { label: 'Auto-run + evidence log', hint: 'Ships automatically, every run recorded', className: 'bg-success/10 text-success' },
  ask_first: { label: 'Ask first', hint: 'Waits for your approval before running', className: 'bg-warning/10 text-warning' },
}

const AUTONOMY_ORDER: AutomationAutonomy[] = ['auto', 'auto_logged', 'ask_first']

function ActionChip({ kind, label, preview }: { kind: AutomationActionKind; label: string; preview?: string }) {
  const Icon = actionIcon[kind]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {label}
      {preview && <span className="hidden max-w-[15rem] truncate text-muted-foreground sm:inline">{'— ' + preview}</span>}
    </span>
  )
}

export default function AutomationsPage() {
  const { addAutomation, toggleAutomation, setAutomationAutonomy } = useData()
  const automations = useAutomations()
  const runs = useAutomationRuns()
  const [tab, setTab] = useState('active')
  const [draft, setDraft] = useState('')
  const [autonomy, setAutonomy] = useState<AutomationAutonomy>('auto_logged')

  const parsed = useMemo(() => (draft.trim().length > 6 ? parseAutomation(draft) : null), [draft])

  function activate() {
    if (!parsed) return
    addAutomation(draft.trim(), autonomy)
    setDraft('')
    setAutonomy('auto_logged')
    setTab('active')
  }

  const runStatusMeta = {
    success: { icon: CheckCircle2, className: 'text-success', label: 'Success' },
    skipped: { icon: MinusCircle, className: 'text-muted-foreground', label: 'Skipped' },
    error: { icon: AlertTriangle, className: 'text-destructive', label: 'Error' },
  } as const

  return (
    <div>
      <PageHeader
        title="Automations"
        description="Describe what you want in plain English. Janus builds and runs it — no flow charts."
      />

      <div className="mx-auto max-w-[1440px] space-y-8 px-4 py-8 sm:px-8">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-6 py-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Tell Janus a new rule</span>
          </div>
          <div className="p-6">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="When an estimate is signed, text the customer a thank you and create a materials task."
              rows={2}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring-2"
            />

            {parsed && (
              <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary/15 text-primary">TRIGGER</Badge>
                  <span className="text-sm font-medium text-foreground">{parsed.triggerLabel}</span>
                  <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="secondary">ACTIONS</Badge>
                  {parsed.actions.map((a, i) => (
                    <ActionChip key={i} kind={a.kind} label={a.label} preview={a.preview} />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {AUTONOMY_ORDER.map((a) => (
                      <button
                        key={a}
                        onClick={() => setAutonomy(a)}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                          autonomy === a ? autonomyMeta[a].className : 'text-muted-foreground hover:bg-secondary',
                        )}
                      >
                        {autonomyMeta[a].label}
                      </button>
                    ))}
                  </div>
                  <Button onClick={activate}>
                    <Zap className="mr-1.5 h-4 w-4" /> Activate
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{autonomyMeta[autonomy].hint}</p>
              </div>
            )}
          </div>
        </Card>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'active', label: 'Active (' + automations.length + ')' },
            { value: 'log', label: 'Run Log (' + runs.length + ')' },
          ]}
        />

        {tab === 'active' && (
          <div className="grid gap-4">
            {automations.map((a) => (
              <Card key={a.id} className={cn('p-6', !a.enabled && 'opacity-60')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-relaxed text-foreground">{a.sentence}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className="bg-primary/15 text-primary">{a.triggerLabel}</Badge>
                      <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      {a.actions.map((act, i) => (
                        <ActionChip key={i} kind={act.kind} label={act.label} preview={act.preview} />
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Switch checked={a.enabled} onCheckedChange={() => toggleAutomation(a.id)} aria-label="Toggle automation" />
                    <span className="text-xs text-muted-foreground">{a.runCount} runs</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                  <span className="mr-1 text-xs font-medium text-muted-foreground">Autonomy</span>
                  {AUTONOMY_ORDER.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAutomationAutonomy(a.id, opt)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        a.autonomy === opt ? autonomyMeta[opt].className : 'text-muted-foreground hover:bg-secondary',
                      )}
                    >
                      {autonomyMeta[opt].label}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === 'log' && (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Trigger</th>
                    <th className="px-4 py-3 font-medium">Job</th>
                    <th className="px-4 py-3 font-medium">Actions taken</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const meta = runStatusMeta[r.status]
                    const Icon = meta.icon
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                        <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{relativeTime(r.ranAt)}</td>
                        <td className="px-4 py-4 font-medium text-foreground">{r.triggerLabel}</td>
                        <td className="px-4 py-4 text-muted-foreground">{r.jobLabel}</td>
                        <td className="px-4 py-4 text-muted-foreground">{r.actionsTaken.join(', ')}</td>
                        <td className="px-4 py-4">
                          <span className={cn('inline-flex items-center gap-1.5 font-medium', meta.className)}>
                            <Icon className="h-4 w-4" /> {meta.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
