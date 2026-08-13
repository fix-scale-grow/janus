'use client'

import Link from 'next/link'
import { useData } from '@/src/lib/data/provider'
import { Sheet } from '@/components/ui/sheet'
import { buttonVariants } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Timeline } from './timeline'
import { Composer } from './composer'
import { StageSelect } from './stage-select'
import { JobCopilot } from '@/components/agent/job-copilot'
import { currency, jobTypeLabels } from '@/src/lib/format'
import { cn } from '@/lib/utils'
import { Maximize2, Phone, MessageSquare, MapPin, X } from 'lucide-react'

export function JobPanel({
  jobId,
  board,
  onClose,
}: {
  jobId: string | null
  board: 'sales' | 'production'
  onClose: () => void
}) {
  const { store } = useData()
  const job = store.jobs.find((j) => j.id === jobId)
  const contact = job ? store.contacts.find((c) => c.id === job.contactId) : undefined
  const rep = job ? store.employees.find((e) => e.id === job.repId) : undefined

  return (
    <Sheet open={!!jobId} onClose={onClose} labelledBy="job-panel-title">
      {job && contact && (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-2 border-b border-border p-4">
            <div className="min-w-0">
              <p id="job-panel-title" className="truncate text-base font-semibold text-foreground">
                {contact.name}
              </p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {contact.address}, {contact.city}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href={`/jobs/${job.id}`}
                onClick={onClose}
                aria-label="Expand to full page"
                className={cn(buttonVariants({ variant: 'outline', size: 'icon' }))}
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button
                onClick={onClose}
                aria-label="Close"
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px border-b border-border bg-border">
            <Stat label="Value" value={currency(job.value)} />
            <Stat label="Type" value={jobTypeLabels[job.jobType]} />
            <div className="col-span-2 bg-card p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Stage</p>
              <StageSelect job={job} board={board} />
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-border p-3">
            <a
              href={`tel:${contact.phone}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1')}
            >
              <Phone className="mr-1.5 h-4 w-4" /> Call
            </a>
            <a
              href={`sms:${contact.phone}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1')}
            >
              <MessageSquare className="mr-1.5 h-4 w-4" /> Text
            </a>
            {rep && (
              <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm">
                <Avatar initials={rep.initials} color={rep.avatarColor} size="sm" />
                <span className="hidden text-muted-foreground sm:inline">{rep.name.split(' ')[0]}</span>
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <JobCopilot jobId={job.id} compact />
            <h3 className="mb-3 mt-4 text-sm font-semibold text-foreground">Activity</h3>
            <Timeline jobId={job.id} />
          </div>

          <div className="border-t border-border p-3">
            <Composer jobId={job.id} />
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}
