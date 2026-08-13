'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react'
import { PageHeader } from '@/components/shell/app-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Timeline } from '@/components/jobs/timeline'
import { useData, useContact } from '@/src/lib/data/provider'
import { jobRepo, timelineRepo } from '@/src/lib/data/repositories'
import {
  currency,
  shortDate,
  jobTypeLabels,
  salesStageMeta,
  productionStageMeta,
  sourceLabel,
} from '@/src/lib/format'
import { cn } from '@/lib/utils'

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { store } = useData()
  const router = useRouter()
  const contact = useContact(id)

  if (!contact) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Contact not found.</p>
        <Link href="/contacts" className="text-sm text-primary underline">
          Back to contacts
        </Link>
      </div>
    )
  }

  const jobs = jobRepo.byContact(store, contact.id)
  const timeline = timelineRepo.byContact(store, contact.id)
  const jobCount = jobs.length

  return (
    <div>
      <PageHeader
        title={contact.name}
        description={`${sourceLabel(contact.source)} · Customer since ${shortDate(contact.createdAt)}`}
        actions={
          <button
            onClick={() => router.back()}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </button>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[340px_1fr]">
        {/* Left: contact card + jobs */}
        <div className="space-y-6">
          <Card className="p-5">
            <div className="space-y-3 text-sm">
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-foreground hover:text-primary">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {contact.phone}
              </a>
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-foreground hover:text-primary">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </a>
              <p className="flex items-start gap-2 text-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {contact.address}
                  <br />
                  {contact.city}, AL {contact.zip}
                </span>
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Lifetime Value</p>
                <p className="text-lg font-semibold text-foreground">{currency(contact.lifetimeValue)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Jobs</p>
                <p className="text-lg font-semibold text-foreground">{jobCount}</p>
              </div>
            </div>
          </Card>

          <div>
            <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Jobs</h2>
            <div className="space-y-2">
              {jobs.length === 0 && <p className="px-1 text-sm text-muted-foreground">No jobs yet.</p>}
              {jobs.map((job) => {
                const meta = job.won && job.productionStage
                  ? productionStageMeta[job.productionStage]
                  : salesStageMeta[job.salesStage]
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="block rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{jobTypeLabels[job.jobType]}</span>
                      <span className="text-sm font-semibold text-foreground">{currency(job.value)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <Badge variant="secondary">{meta.label}</Badge>
                      <span className="text-xs text-muted-foreground">{shortDate(job.createdAt)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: full communication history */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Communication History</h2>
          <Card className="p-4">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No communication logged yet.</p>
            ) : (
              <Timeline entries={timeline} />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
