'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shell/app-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea, Input, Label } from '@/components/ui/input'
import { useAiCalls } from '@/src/lib/data/provider'
import { duration } from '@/src/lib/format'
import {
  PhoneCall,
  PhoneForwarded,
  Play,
  Clock,
  ShieldAlert,
  Sparkles,
  CircleDot,
} from 'lucide-react'

const DEFAULT_GREETING = `Thanks for calling Summit Ridge Roofing, this is Janus, the virtual assistant. How can I help you today?`

const DEFAULT_BOOKING = `If the caller wants an estimate or has roof damage, collect their {name}, {property_address}, and {phone}. Ask whether it's an {insurance_claim}. Offer the earliest open inspection slot from the schedule. Confirm by text.`

interface Escalation {
  id: string
  trigger: string
  action: string
  target: string
}

const ESCALATIONS: Escalation[] = [
  { id: 'e1', trigger: 'Caller says "emergency" or "active leak"', action: 'Ring owner cell immediately', target: 'Dale Whitfield · (256) 555-0142' },
  { id: 'e2', trigger: 'Caller is an existing customer with a warranty issue', action: 'Transfer to office manager', target: 'Brenda Whitfield · (256) 555-0148' },
  { id: 'e3', trigger: 'Caller asks for commercial / metal roofing', action: 'Take message, route to sales', target: 'Sales queue' },
  { id: 'e4', trigger: 'Caller is upset or requests a manager', action: 'Transfer to owner, log sentiment', target: 'Dale Whitfield · (256) 555-0142' },
]

export default function PhoneAgentPage() {
  const aiCalls = useAiCalls()
  const [enabled, setEnabled] = useState(true)
  const [greeting, setGreeting] = useState(DEFAULT_GREETING)
  const [booking, setBooking] = useState(DEFAULT_BOOKING)
  const [simCall, setSimCall] = useState(aiCalls[0])
  const [revealed, setRevealed] = useState(0)
  const [playing, setPlaying] = useState(false)

  const afterHours = new Date().getHours() >= 17 || new Date().getHours() < 8

  function runSimulator() {
    setRevealed(0)
    setPlaying(true)
    let i = 0
    const tick = () => {
      i += 1
      setRevealed(i)
      if (i < simCall.transcript.length) {
        setTimeout(tick, 700)
      } else {
        setPlaying(false)
      }
    }
    setTimeout(tick, 300)
  }

  return (
    <div>
      <PageHeader
        title="Phone Agent"
        description="Your AI receptionist answers, qualifies, and books — around the clock."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{enabled ? 'On duty' : 'Off'}</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        }
      />

      <div className="grid gap-5 p-6 lg:grid-cols-3">
        {/* Live status */}
        <Card className="lg:col-span-3">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <PhoneCall className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`absolute inline-flex h-full w-full rounded-full ${enabled ? 'animate-ping bg-success/60' : ''}`} />
                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${enabled ? 'bg-success' : 'bg-muted-foreground'}`} />
                  </span>
                  <p className="text-base font-semibold text-foreground">
                    {enabled ? (afterHours ? 'On duty — after-hours mode' : 'On duty — business hours') : 'Not answering'}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {enabled
                    ? afterHours
                      ? 'Taking messages, booking routine jobs, escalating emergencies to the owner cell.'
                      : 'Answering live, booking inspections, and routing to your team.'
                    : 'Calls are going to voicemail. Turn the agent on to start answering.'}
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">1.2s</p>
                <p className="text-xs text-muted-foreground">Avg pickup</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">47</p>
                <p className="text-xs text-muted-foreground">Calls this week</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">18</p>
                <p className="text-xs text-muted-foreground">Jobs booked</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Script editors */}
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Greeting script</h3>
            </div>
            <Textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={2} />
            <p className="mt-2 text-xs text-muted-foreground">First thing every caller hears.</p>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Booking script</h3>
            </div>
            <Textarea value={booking} onChange={(e) => setBooking(e.target.value)} rows={4} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {['{name}', '{property_address}', '{phone}', '{insurance_claim}', '{job_type}', '{eta}'].map((v) => (
                <button
                  key={v}
                  onClick={() => setBooking((b) => `${b} ${v}`)}
                  className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Click a variable to insert it. The agent fills these from the live conversation.
            </p>
          </Card>

          {/* Escalation rules */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Escalation rules</h3>
            </div>
            <div className="divide-y divide-border">
              {ESCALATIONS.map((e) => (
                <div key={e.id} className="grid gap-2 p-4 sm:grid-cols-[1.4fr_1fr_1fr]">
                  <div className="flex items-start gap-2">
                    <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <p className="text-sm text-foreground">{e.trigger}</p>
                  </div>
                  <p className="text-sm text-muted-foreground sm:text-center">{e.action}</p>
                  <p className="text-sm font-medium text-foreground sm:text-right">{e.target}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Call simulator */}
        <Card className="flex flex-col lg:col-span-1">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Call simulator</h3>
            </div>
            <Button size="sm" onClick={runSimulator} disabled={playing}>
              {playing ? 'Playing…' : 'Run'}
            </Button>
          </div>

          <div className="border-b border-border p-3">
            <Label className="mb-1.5 block text-xs">Sample scenario</Label>
            <div className="flex flex-wrap gap-1.5">
              {aiCalls.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSimCall(c)
                    setRevealed(0)
                  }}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    simCall.id === c.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {c.extracted.issue.slice(0, 22)}…
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {simCall.transcript.slice(0, revealed || simCall.transcript.length).map((turn, i) => (
              <div key={i} className={`flex ${turn.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                <div className="max-w-[85%]">
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      turn.speaker === 'agent'
                        ? 'rounded-tl-sm bg-primary/10 text-foreground'
                        : 'rounded-tr-sm bg-muted text-foreground'
                    }`}
                  >
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {turn.speaker === 'agent' ? 'Janus' : simCall.callerName.split(' ')[0]}
                    </p>
                    {turn.text}
                  </div>
                  {turn.decision && (
                    <div className="mt-1 flex items-start gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      <p className="text-xs text-primary">{turn.decision}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {duration(simCall.durationSec)}
              </span>
              <span className="flex items-center gap-1">
                <PhoneForwarded className="h-3 w-3" /> {simCall.actionsTaken.length} actions
              </span>
              <span>{Math.round(simCall.confidence * 100)}% conf.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
