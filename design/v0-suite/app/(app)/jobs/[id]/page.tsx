'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useData, usePhotos, useDocuments } from '@/src/lib/data/provider'
import { estimateRepo, invoiceRepo } from '@/src/lib/data/repositories'
import { Timeline } from '@/components/jobs/timeline'
import { Composer } from '@/components/jobs/composer'
import { StageSelect } from '@/components/jobs/stage-select'
import { JobCopilot } from '@/components/agent/job-copilot'
import { Tabs } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { currency, jobTypeLabels, shortDate, salesStageMeta, productionStageMeta } from '@/src/lib/format'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  MapPin,
  Phone,
  MessageSquare,
  ImagePlus,
  FileText,
  ShieldCheck,
  Plus,
} from 'lucide-react'

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { store, addPhoto } = useData()
  const [tab, setTab] = useState('timeline')

  const job = store.jobs.find((j) => j.id === id)
  const photos = usePhotos(id)
  const documents = useDocuments(id)

  if (!job) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Job not found.</p>
        <Link href="/sales" className="text-primary hover:underline">
          Back to Sales
        </Link>
      </div>
    )
  }

  const contact = store.contacts.find((c) => c.id === job.contactId)
  const rep = store.employees.find((e) => e.id === job.repId)
  const estimate = estimateRepo.byJob(store, id)
  const invoice = invoiceRepo.byJob(store, id)
  const board: 'sales' | 'production' = job.won ? 'production' : 'sales'
  const stageMeta = job.won
    ? productionStageMeta[job.productionStage ?? 'approved']
    : salesStageMeta[job.salesStage]

  const tabs = [
    { value: 'timeline', label: 'Timeline' },
    { value: 'photos', label: 'Photos', count: photos.length },
    { value: 'documents', label: 'Documents', count: documents.length },
    { value: 'estimate', label: 'Estimate' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'insurance', label: 'Insurance' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
      <Link
        href={job.won ? '/production' : '/sales'}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {job.won ? 'Production' : 'Sales'}
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{contact?.name}</h1>
              <Badge variant="secondary">{stageMeta.label}</Badge>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {contact?.address}, {contact?.city}, AL {contact?.zip}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a href={`tel:${contact?.phone}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                <Phone className="mr-1.5 h-4 w-4" /> Call
              </a>
              <a href={`sms:${contact?.phone}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                <MessageSquare className="mr-1.5 h-4 w-4" /> Text
              </a>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-5">
            <div>
              <p className="text-xs text-muted-foreground">Job value</p>
              <p className="text-2xl font-semibold tracking-tight">{currency(job.value)}</p>
            </div>
            {rep && (
              <div className="text-center">
                <Avatar initials={rep.initials} color={rep.avatarColor} size="lg" title={rep.name} />
                <p className="mt-1 text-xs text-muted-foreground">{rep.name.split(' ')[0]}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <Meta label="Job type" value={jobTypeLabels[job.jobType]} />
          <Meta label="Created" value={shortDate(job.createdAt)} />
          {job.scheduledDate && <Meta label="Scheduled" value={shortDate(job.scheduledDate)} />}
          {job.crewName && <Meta label="Crew" value={job.crewName} />}
          <div>
            <p className="text-xs text-muted-foreground">Stage</p>
            <div className="mt-1">
              <StageSelect job={job} board={board} />
            </div>
          </div>
        </div>
      </div>

      {/* Map placeholder */}
      <div className="mt-4 flex h-40 items-center justify-center rounded-xl border border-border bg-muted/50">
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <MapPin className="h-6 w-6" />
          <p className="text-sm">{contact?.address}, {contact?.city}</p>
          <p className="text-xs">Map preview</p>
        </div>
      </div>

      {/* AI copilot */}
      <div className="mt-5">
        <JobCopilot jobId={job.id} />
      </div>

      {/* Tabs */}
      <div className="mt-5">
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-4" />

        {tab === 'timeline' && (
          <div className="space-y-4">
            <Composer jobId={job.id} />
            <div className="rounded-xl border border-border bg-card p-4">
              <Timeline jobId={job.id} />
            </div>
          </div>
        )}

        {tab === 'photos' && (
          <div>
            <div className="mb-3 flex justify-end">
              <Button size="sm" onClick={() => addPhoto(job.id, 'Field photo')}>
                <ImagePlus className="mr-1.5 h-4 w-4" /> Upload photo
              </Button>
            </div>
            {photos.length === 0 ? (
              <Empty icon={ImagePlus} label="No photos yet." />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((p) => (
                  <figure key={p.id} className="overflow-hidden rounded-lg border border-border bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url || '/placeholder.svg'} alt={p.caption} className="aspect-[4/3] w-full object-cover" />
                    <figcaption className="px-2 py-1.5 text-xs text-muted-foreground">
                      <span className="line-clamp-1 text-foreground">{p.caption}</span>
                      <span>{shortDate(p.uploadedAt)} · {p.uploadedBy}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'documents' && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {documents.length === 0 ? (
              <Empty icon={FileText} label="No documents." />
            ) : (
              <ul className="divide-y divide-border">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.type.toUpperCase()} · {d.sizeKb} KB · {shortDate(d.uploadedAt)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">Download</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'estimate' && (
          <div className="rounded-xl border border-border bg-card p-4">
            {estimate ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Estimate {estimate.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {currency(estimateRepo.total(estimate, estimate.selectedTier).total)} ·{' '}
                    <span className="capitalize">{estimate.status}</span>
                  </p>
                </div>
                <Link href={`/estimates/${estimate.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                  Open estimate
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">No estimate created for this job.</p>
                <Link href="/estimates" className={cn(buttonVariants({ size: 'sm' }))}>
                  <Plus className="mr-1.5 h-4 w-4" /> New estimate
                </Link>
              </div>
            )}
          </div>
        )}

        {tab === 'invoice' && (
          <div className="rounded-xl border border-border bg-card p-4">
            {invoice ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Invoice {invoice.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {currency(invoice.total)} · balance {currency(invoiceRepo.balance(invoice))} ·{' '}
                    <span className="capitalize">{invoice.status}</span>
                  </p>
                </div>
                <Link href={`/invoices/${invoice.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                  Open invoice
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No invoice yet.</p>
            )}
          </div>
        )}

        {tab === 'insurance' && <InsurancePanel jobId={job.id} />}
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  )
}

function Empty({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
      <Icon className="h-8 w-8" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

function InsurancePanel({ jobId }: { jobId: string }) {
  const { store } = useData()
  const job = store.jobs.find((j) => j.id === jobId)
  const [form, setForm] = useState({
    carrier: job?.insurance?.carrier ?? '',
    claimNumber: job?.insurance?.claimNumber ?? '',
    adjuster: job?.insurance?.adjuster ?? '',
    adjusterPhone: job?.insurance?.adjusterPhone ?? '',
    deductible: job?.insurance?.deductible ?? 0,
  })

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="h-4 w-4 text-primary" /> Insurance claim
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Carrier">
          <Input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="e.g. State Farm" />
        </Field>
        <Field label="Claim number">
          <Input value={form.claimNumber} onChange={(e) => setForm({ ...form, claimNumber: e.target.value })} placeholder="Claim #" />
        </Field>
        <Field label="Adjuster">
          <Input value={form.adjuster} onChange={(e) => setForm({ ...form, adjuster: e.target.value })} placeholder="Adjuster name" />
        </Field>
        <Field label="Adjuster phone">
          <Input value={form.adjusterPhone} onChange={(e) => setForm({ ...form, adjusterPhone: e.target.value })} placeholder="(205) 555-0100" />
        </Field>
        <Field label="Deductible">
          <Input
            type="number"
            value={form.deductible}
            onChange={(e) => setForm({ ...form, deductible: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm">Save insurance info</Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
