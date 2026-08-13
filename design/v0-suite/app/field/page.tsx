'use client'

import { useMemo, useState } from 'react'
import { Phone, Navigation, Camera, CheckCircle2, ChevronLeft, PenLine, ClipboardList, Hammer } from 'lucide-react'
import { useData, useJobs, useContacts } from '@/src/lib/data/provider'
import { jobTypeLabels, currency, shortDate } from '@/src/lib/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Job } from '@/src/lib/data/types'
import { FieldVoiceAgent, type FieldParsedAction } from '@/components/agent/field-voice'

const CHECKLIST = [
  'Confirm materials on site',
  'Protect landscaping & drive',
  'Tear off existing shingles',
  'Inspect & repair decking',
  'Install underlayment',
  'Install shingles & flashing',
  'Full cleanup & magnet sweep',
  'Final walkthrough with homeowner',
]

export default function FieldPage() {
  const jobs = useJobs()
  const contacts = useContacts()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // "Today's" work = won jobs currently in an active production stage.
  const todaysJobs = useMemo(
    () =>
      jobs.filter(
        (j) => j.won && j.productionStage && ['scheduled', 'in_progress', 'punch_list'].includes(j.productionStage),
      ),
    [jobs],
  )

  const selected = todaysJobs.find((j) => j.id === selectedId) ?? null

  if (selected) {
    return <FieldJobView job={selected} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Hammer className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-foreground">Field Mode</p>
            <p className="text-xs text-muted-foreground">Levi Stallworth · Crew A</p>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4">
        <h1 className="text-lg font-bold text-foreground">Today&apos;s jobs</h1>
        <p className="text-sm text-muted-foreground">
          {todaysJobs.length} stops · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>

      <div className="mt-4 space-y-3 px-4">
        {todaysJobs.map((job) => {
          const contact = contacts.find((c) => c.id === job.contactId)!
          return (
            <button
              key={job.id}
              onClick={() => setSelectedId(job.id)}
              className="block w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {jobTypeLabels[job.jobType]}
                </span>
                <span className="text-sm font-semibold text-foreground">{currency(job.value)}</span>
              </div>
              <p className="mt-2 text-base font-bold text-foreground">{contact.name}</p>
              <p className="text-sm text-muted-foreground">
                {contact.address}, {contact.city}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(contact.address + ', ' + contact.city)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary text-sm font-semibold text-secondary-foreground active:bg-muted"
                >
                  <Navigation className="h-4 w-4" /> Navigate
                </a>
                <a
                  href={`tel:${contact.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-secondary text-sm font-semibold text-secondary-foreground active:bg-muted"
                >
                  <Phone className="h-4 w-4" /> Call
                </a>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FieldJobView({ job, onBack }: { job: Job; onBack: () => void }) {
  const { addTimelineEntry, moveProductionStage } = useData()
  const contacts = useContacts()
  const contact = contacts.find((c) => c.id === job.contactId)!
  const [checked, setChecked] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true })
  const [photos, setPhotos] = useState<string[]>(['Front elevation', 'Ridge line'])
  const [completed, setCompleted] = useState(false)
  const [signed, setSigned] = useState(false)

  const doneCount = Object.values(checked).filter(Boolean).length

  function markComplete() {
    setCompleted(true)
    addTimelineEntry(job.id, 'note', 'Field crew marked job complete on site.')
    moveProductionStage(job.id, 'punch_list')
  }

  function handleVoiceActions(actions: FieldParsedAction[]) {
    // Apply real store effects for the actions Janus parsed from the crew's voice note.
    for (const a of actions) {
      if (a.label.toLowerCase().includes('complete')) {
        setCompleted(true)
        moveProductionStage(job.id, 'punch_list')
      }
      addTimelineEntry(job.id, 'note', `Janus (from field voice note): ${a.label} — ${a.detail}`)
    }
  }

  return (
    <div className="mx-auto max-w-md pb-28">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <ChevronLeft className="h-5 w-5" /> Today&apos;s jobs
        </button>
      </header>

      <div className="px-4 pt-4">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {jobTypeLabels[job.jobType]}
        </span>
        <h1 className="mt-2 text-xl font-bold text-foreground">{contact.name}</h1>
        <p className="text-sm text-muted-foreground">
          {contact.address}, {contact.city}
        </p>
        {job.scheduledDate && (
          <p className="mt-1 text-xs text-muted-foreground">Scheduled {shortDate(job.scheduledDate)}</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(contact.address + ', ' + contact.city)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          >
            <Navigation className="h-4 w-4" /> Navigate
          </a>
          <a
            href={`tel:${contact.phone}`}
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-secondary text-sm font-semibold text-secondary-foreground"
          >
            <Phone className="h-4 w-4" /> Call
          </a>
        </div>
      </div>

      {/* Hold-to-talk agent */}
      <div className="mt-6">
        <FieldVoiceAgent onConfirm={handleVoiceActions} />
      </div>

      {/* Checklist */}
      <section className="mt-6 px-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <ClipboardList className="h-4 w-4 text-primary" /> Job checklist
          </h2>
          <span className="text-xs text-muted-foreground">
            {doneCount}/{CHECKLIST.length}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {CHECKLIST.map((item, i) => {
            const isDone = !!checked[i]
            return (
              <button
                key={i}
                onClick={() => setChecked((p) => ({ ...p, [i]: !p[i] }))}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm active:scale-[0.99]',
                  isDone ? 'border-success/30 bg-success/5' : 'border-border bg-card',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                    isDone ? 'border-success bg-success text-success-foreground' : 'border-muted-foreground/40',
                  )}
                >
                  {isDone && <CheckCircle2 className="h-4 w-4" />}
                </span>
                <span className={cn('font-medium', isDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
                  {item}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Photos */}
      <section className="mt-6 px-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Camera className="h-4 w-4 text-primary" /> Photos ({photos.length})
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((cap, i) => (
            <div key={i} className="flex aspect-square flex-col items-center justify-center rounded-xl border border-border bg-muted/50 p-2 text-center">
              <Camera className="h-5 w-5 text-muted-foreground" />
              <span className="mt-1 text-[10px] leading-tight text-muted-foreground">{cap}</span>
            </div>
          ))}
          <button
            onClick={() => setPhotos((p) => [...p, `Photo ${p.length + 1}`])}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground active:bg-secondary"
          >
            <Camera className="h-5 w-5" />
            <span className="text-[10px] font-medium">Add</span>
          </button>
        </div>
      </section>

      {/* Complete + signature */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-border bg-background p-4">
        {completed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm font-semibold text-success">
              <CheckCircle2 className="h-5 w-5" /> Job marked complete
            </div>
            <button
              onClick={() => setSigned(true)}
              className={cn(
                'flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold',
                signed ? 'border-success/40 bg-success/5 text-success' : 'border-border text-muted-foreground',
              )}
            >
              <PenLine className="h-5 w-5" />
              {signed ? 'Homeowner signature captured' : 'Tap to capture homeowner signature'}
            </button>
          </div>
        ) : (
          <Button size="lg" className="h-14 w-full text-base" onClick={markComplete}>
            <CheckCircle2 className="mr-2 h-5 w-5" /> Mark job complete
          </Button>
        )}
      </div>
    </div>
  )
}
