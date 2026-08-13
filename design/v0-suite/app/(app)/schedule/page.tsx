'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, CalendarClock, GripVertical } from 'lucide-react'
import { PageHeader } from '@/components/shell/app-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useData } from '@/src/lib/data/provider'
import { crews } from '@/src/lib/data/seed'
import { currency, jobTypeLabels } from '@/src/lib/format'
import type { Job } from '@/src/lib/data/types'
import { cn } from '@/lib/utils'

const DAY_MS = 86400000

function startOfWeek(d: Date) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() - copy.getDay())
  return copy
}

function JobChip({ job, contactName }: { job: Job; contactName: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'group cursor-grab touch-none rounded-md border border-border bg-card p-2 text-left shadow-sm active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-1">
        <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        <p className="truncate text-xs font-medium text-foreground">{contactName}</p>
      </div>
      <p className="truncate pl-4 text-[11px] text-muted-foreground">{jobTypeLabels[job.jobType]}</p>
      <p className="pl-4 text-[11px] font-semibold tabular-nums text-primary">{currency(job.value, true)}</p>
    </div>
  )
}

function DayCell({
  id,
  children,
  isToday,
}: {
  id: string
  children: React.ReactNode
  isToday?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-24 space-y-1.5 border-l border-border p-1.5 transition-colors',
        isToday && 'bg-accent/40',
        isOver && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
      )}
    >
      {children}
    </div>
  )
}

export default function SchedulePage() {
  const { store, scheduleJob } = useData()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS)),
    [weekStart],
  )

  const contactName = (id: string) => store.contacts.find((c) => c.id === id)?.name ?? 'Unknown'

  const productionJobs = store.jobs.filter((j) => j.won && j.productionStage !== 'paid')
  const unscheduled = productionJobs.filter((j) => !j.scheduledDate || !j.crewName)

  const jobsFor = (crew: string, day: Date) => {
    const dayKey = day.toISOString().slice(0, 10)
    return productionJobs.filter(
      (j) => j.crewName === crew && j.scheduledDate?.slice(0, 10) === dayKey,
    )
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const jobId = String(e.active.id)
    const over = e.over?.id ? String(e.over.id) : null
    if (!over || !over.includes('::')) return
    const [crew, dayKey] = over.split('::')
    const date = new Date(dayKey + 'T09:00:00')
    scheduleJob(jobId, crew, date.toISOString())
  }

  const activeJob = activeId ? store.jobs.find((j) => j.id === activeId) : null

  const weekLabel = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  const todayKey = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <PageHeader
        title="Schedule"
        description={weekLabel}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY_MS))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-4 p-4 sm:px-6 lg:grid-cols-[1fr_240px]">
          {/* Week grid */}
          <Card className="overflow-x-auto p-0">
            <div className="min-w-[720px]">
              {/* Header row */}
              <div className="grid grid-cols-[100px_repeat(7,1fr)] border-b border-border bg-muted/40">
                <div className="p-2 text-xs font-medium text-muted-foreground">Crew</div>
                {days.map((d) => {
                  const key = d.toISOString().slice(0, 10)
                  return (
                    <div
                      key={key}
                      className={cn(
                        'border-l border-border p-2 text-center',
                        key === todayKey && 'bg-accent/60',
                      )}
                    >
                      <p className="text-xs font-medium text-foreground">
                        {d.toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <p className="text-xs text-muted-foreground">{d.getDate()}</p>
                    </div>
                  )
                })}
              </div>
              {/* Crew rows */}
              {crews.map((crew) => (
                <div key={crew} className="grid grid-cols-[100px_repeat(7,1fr)] border-b border-border last:border-0">
                  <div className="flex items-center p-2 text-xs font-medium text-foreground">{crew}</div>
                  {days.map((d) => {
                    const key = d.toISOString().slice(0, 10)
                    return (
                      <DayCell key={key} id={`${crew}::${key}`} isToday={key === todayKey}>
                        {jobsFor(crew, d).map((job) => (
                          <JobChip key={job.id} job={job} contactName={contactName(job.contactId)} />
                        ))}
                      </DayCell>
                    )
                  })}
                </div>
              ))}
            </div>
          </Card>

          {/* Unscheduled tray */}
          <Card className="p-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <CalendarClock className="h-4 w-4 text-primary" />
              Unscheduled
              <span className="ml-auto rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                {unscheduled.length}
              </span>
            </h2>
            <div className="space-y-2">
              {unscheduled.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">Everything is scheduled.</p>
              )}
              {unscheduled.map((job) => (
                <JobChip key={job.id} job={job} contactName={contactName(job.contactId)} />
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Drag a job onto a crew and day to schedule it. Drag between cells to reassign.
            </p>
          </Card>
        </div>

        <DragOverlay>
          {activeJob ? (
            <div className="w-40 rounded-md border border-primary/40 bg-card p-2 shadow-lg">
              <p className="truncate text-xs font-medium text-foreground">{contactName(activeJob.contactId)}</p>
              <p className="truncate text-[11px] text-muted-foreground">{jobTypeLabels[activeJob.jobType]}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
