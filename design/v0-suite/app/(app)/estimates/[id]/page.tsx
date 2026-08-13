'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, FileSignature, PenLine, Receipt, Send } from 'lucide-react'
import { PageHeader } from '@/components/shell/app-shell'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { useData } from '@/src/lib/data/provider'
import { estimateTotals } from '@/src/lib/data/repositories'
import { currency, longDateTime } from '@/src/lib/format'
import type { EstimateTier } from '@/src/lib/data/types'
import { cn } from '@/lib/utils'

const TIERS: EstimateTier[] = ['good', 'better', 'best']
const TIER_LABEL: Record<EstimateTier, string> = { good: 'Good', better: 'Better', best: 'Best' }

export default function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { store, sendEstimate, signEstimate, selectEstimateTier, convertEstimateToInvoice } = useData()
  const est = store.estimates.find((e) => e.id === id)
  const [converted, setConverted] = useState<string | null>(null)

  const contact = est ? store.contacts.find((c) => c.id === est.contactId) : null

  const sections = useMemo(() => {
    if (!est) return []
    const map = new Map<string, typeof est.lineItems>()
    for (const li of est.lineItems) {
      if (!map.has(li.section)) map.set(li.section, [])
      map.get(li.section)!.push(li)
    }
    return Array.from(map.entries())
  }, [est])

  if (!est) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Estimate not found.</p>
        <Link href="/estimates" className="text-sm text-primary underline">Back to estimates</Link>
      </div>
    )
  }

  const selectedTier = est.selectedTier ?? 'best'
  const tierTotals = (t: EstimateTier) => estimateTotals(est, t)
  const totals = estimateTotals(est, selectedTier)

  return (
    <div>
      <PageHeader
        title={`Estimate ${est.number}`}
        description={contact?.name}
        actions={
          <button onClick={() => router.back()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </button>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Tier option columns */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Choose your package</h2>
              <p className="text-xs text-muted-foreground">The customer picks one option. Best includes everything.</p>
            </div>
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
              {TIERS.map((t) => {
                const active = selectedTier === t
                const tt = tierTotals(t)
                return (
                  <button
                    key={t}
                    onClick={() => selectEstimateTier(est.id, t)}
                    className={cn(
                      'flex flex-col gap-1 bg-card p-4 text-left transition-colors hover:bg-muted/50',
                      active && 'bg-accent hover:bg-accent',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{TIER_LABEL[t]}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <span className="text-xl font-bold text-foreground">{currency(tt.total)}</span>
                    <span className="text-xs text-muted-foreground">{tt.items.length} line items</span>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Line items by section */}
          {sections.map(([section, items]) => (
            <Card key={section} className="overflow-hidden">
              <div className="border-b border-border bg-muted/40 px-5 py-2.5">
                <h3 className="text-sm font-semibold text-foreground">{section}</h3>
              </div>
              <div className="divide-y divide-border">
                {items.map((li) => (
                  <div key={li.id} className="flex items-center gap-4 px-5 py-3">
                    {li.photoUrl && (
                      <img
                        src={li.photoUrl || '/placeholder.svg'}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-md object-cover"
                        crossOrigin="anonymous"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{li.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {li.qty} × {currency(li.unitPrice)} · {TIER_LABEL[li.tier]}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-foreground">
                      {currency(li.qty * li.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Sidebar: totals + actions + e-sign tracker */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusChip kind="estimate" value={est.status} />
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums text-foreground">{currency(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax ({(est.taxRate * 100).toFixed(1)}%)</dt>
                <dd className="tabular-nums text-foreground">{currency(totals.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt className="text-foreground">Total</dt>
                <dd className="tabular-nums text-foreground">{currency(totals.total)}</dd>
              </div>
            </dl>
          </Card>

          {/* e-sign tracker */}
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileSignature className="h-4 w-4 text-primary" /> Signature
            </h3>
            <ol className="space-y-3">
              <SignStep done label="Estimate drafted" at={est.createdAt} />
              <SignStep
                done={est.status !== 'draft'}
                label="Sent for signature"
                at={est.sentAt}
              />
              <SignStep done={est.status === 'signed'} label="Signed by customer" at={est.signedAt} />
            </ol>

            <div className="mt-4 space-y-2">
              {est.status === 'draft' && (
                <Button className="w-full" onClick={() => sendEstimate(est.id)}>
                  <Send className="mr-1.5 h-4 w-4" /> Send for signature
                </Button>
              )}
              {(est.status === 'sent' || est.status === 'viewed') && (
                <Button className="w-full" onClick={() => signEstimate(est.id)}>
                  <PenLine className="mr-1.5 h-4 w-4" /> Simulate customer signing
                </Button>
              )}
              {est.status === 'signed' && (
                <>
                  {converted ? (
                    <Link href={`/invoices/${converted}`} className={cn(buttonVariants({ variant: 'default' }), 'w-full')}>
                      <Receipt className="mr-1.5 h-4 w-4" /> View invoice
                    </Link>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => setConverted(convertEstimateToInvoice(est.id))}
                    >
                      <Receipt className="mr-1.5 h-4 w-4" /> Convert to invoice
                    </Button>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SignStep({ done, label, at }: { done?: boolean; label: string; at?: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          done ? 'border-success bg-success text-success-foreground' : 'border-border bg-muted text-transparent',
        )}
      >
        <Check className="h-3 w-3" />
      </span>
      <div>
        <p className={cn('text-sm', done ? 'font-medium text-foreground' : 'text-muted-foreground')}>{label}</p>
        {at && <p className="text-xs text-muted-foreground">{longDateTime(at)}</p>}
      </div>
    </li>
  )
}
