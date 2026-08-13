'use client'

import { useRef, useState } from 'react'
import { Mic, Sparkles, CheckCircle2, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FieldParsedAction {
  label: string
  detail: string
}

/** Canned voice scenarios keyed loosely — a real build would stream audio to STT. */
const SCENARIOS: { transcript: string; actions: FieldParsedAction[] }[] = [
  {
    transcript: 'Job done, homeowner wants a gutter quote.',
    actions: [
      { label: 'Mark job complete', detail: 'Moves this job to Punch List and logs completion' },
      { label: 'Create gutter lead', detail: 'New lead for this address, tagged "gutters", assigned to sales' },
      { label: 'Draft quote intro text', detail: '"Hi — thanks for having Summit Ridge out today. Here\u2019s that gutter quote we talked about…"' },
    ],
  },
  {
    transcript: 'Ran into rotten decking on the north slope, need three more sheets of plywood.',
    actions: [
      { label: 'Log change order', detail: 'Adds decking repair note + 3 sheets plywood to the job' },
      { label: 'Order materials', detail: '3 sheets 1/2" CDX plywood from ABC Supply, deliver to site' },
      { label: 'Notify office', detail: 'Texts the office manager about the scope change for billing' },
    ],
  },
  {
    transcript: 'Homeowner is thrilled, wants us to look at their rental property too.',
    actions: [
      { label: 'Create new lead', detail: 'Second property lead linked to this happy customer' },
      { label: 'Request a review', detail: 'Queues a Google review text for after final invoice' },
      { label: 'Flag for sales', detail: 'Notifies the sales rep about the referral opportunity' },
    ],
  },
]

export function FieldVoiceAgent({ onConfirm }: { onConfirm?: (a: FieldParsedAction[]) => void }) {
  const [phase, setPhase] = useState<'idle' | 'listening' | 'processing' | 'result' | 'done'>('idle')
  const [scenario, setScenario] = useState(SCENARIOS[0])
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startHold() {
    setPhase('listening')
    // pick a scenario for this session
    setScenario(SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)])
  }

  function endHold() {
    if (phase !== 'listening') return
    setPhase('processing')
    holdTimer.current = setTimeout(() => setPhase('result'), 1100)
  }

  function confirm() {
    setPhase('done')
    onConfirm?.(scenario.actions)
  }

  function reset() {
    setPhase('idle')
  }

  return (
    <section className="px-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Tell Janus</h2>
          <span className="ml-auto text-[11px] text-muted-foreground">Hold to talk</span>
        </div>

        {phase === 'done' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm font-semibold text-success">
              <CheckCircle2 className="h-5 w-5" /> Janus handled it — {scenario.actions.length} actions done
            </div>
            <ul className="space-y-1">
              {scenario.actions.map((a) => (
                <li key={a.label} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" /> {a.label}
                </li>
              ))}
            </ul>
            <button onClick={reset} className="mt-1 text-xs font-medium text-primary">
              Say something else
            </button>
          </div>
        ) : phase === 'result' ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-card p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">You said</p>
              <p className="text-sm italic text-foreground">&ldquo;{scenario.transcript}&rdquo;</p>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Janus will
              </p>
              <ul className="space-y-2">
                {scenario.actions.map((a) => (
                  <li key={a.label} className="rounded-xl border border-border bg-card p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> {a.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={reset}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary text-sm font-semibold text-secondary-foreground"
              >
                <X className="h-4 w-4" /> Discard
              </button>
              <button
                onClick={confirm}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              >
                <CheckCircle2 className="h-4 w-4" /> Do it
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-2">
            <button
              onMouseDown={startHold}
              onMouseUp={endHold}
              onMouseLeave={endHold}
              onTouchStart={(e) => {
                e.preventDefault()
                startHold()
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                endHold()
              }}
              disabled={phase === 'processing'}
              className={cn(
                'flex h-20 w-20 items-center justify-center rounded-full text-primary-foreground transition-transform',
                phase === 'listening' ? 'scale-110 bg-destructive' : 'bg-primary active:scale-95',
              )}
              aria-label="Hold to talk to Janus"
            >
              {phase === 'processing' ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </button>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {phase === 'listening'
                ? 'Listening… release to send'
                : phase === 'processing'
                  ? 'Understanding…'
                  : 'Hold and speak — e.g. "job done, homeowner wants a gutter quote"'}
            </p>
            {phase === 'listening' && (
              <div className="mt-2 flex items-end gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-1 animate-pulse rounded-full bg-destructive"
                    style={{ height: `${8 + ((i * 7) % 20)}px`, animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
