'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useData } from '@/src/lib/data/provider'
import { Avatar } from '@/components/ui/avatar'
import { currency, jobTypeLabels, shortDate } from '@/src/lib/format'
import { daysInStage } from '@/src/lib/data/repositories'
import type { Job } from '@/src/lib/data/types'
import { cn } from '@/lib/utils'
import { MapPin, CalendarDays, Clock } from 'lucide-react'

export function JobCard({
  job,
  board,
  onOpen,
  overlay = false,
}: {
  job: Job
  board: 'sales' | 'production'
  onOpen?: (id: string) => void
  overlay?: boolean
}) {
  const { store, now } = useData()
  const contact = store.contacts.find((c) => c.id === job.contactId)
  const rep = store.employees.find((e) => e.id === job.repId)
  const crew = job.crewName
  const days = daysInStage(job, now)
  const stale = days > 7 && board === 'sales' && job.salesStage !== 'approved'

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    data: { board },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(job.id)}
      className={cn(
        'group cursor-grab touch-none rounded-lg border border-border bg-card p-3 text-left shadow-xs transition-shadow active:cursor-grabbing',
        'hover:border-primary/40 hover:shadow-md',
        overlay && 'rotate-2 shadow-xl',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-foreground">{contact?.name}</p>
        <span className="shrink-0 text-sm font-semibold text-foreground">{currency(job.value, true)}</span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {contact?.address}, {contact?.city}
        </span>
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {jobTypeLabels[job.jobType]}
        </span>
        {board === 'production' && crew && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium text-primary">{crew}</span>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
        <span
          className={cn(
            'flex items-center gap-1 text-[11px] font-medium',
            stale ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {board === 'production' && job.scheduledDate ? (
            <>
              <CalendarDays className="h-3 w-3" /> {shortDate(job.scheduledDate)}
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" /> {days}d in stage
            </>
          )}
        </span>
        {rep && <Avatar initials={rep.initials} color={rep.avatarColor} size="sm" title={rep.name} />}
      </div>
    </div>
  )
}
