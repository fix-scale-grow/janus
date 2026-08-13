'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CreditCard, MessageSquare } from 'lucide-react'
import { PageHeader } from '@/components/shell/app-shell'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { useData } from '@/src/lib/data/provider'
import { invoiceRepo } from '@/src/lib/data/repositories'
import { currency, shortDate, longDateTime } from '@/src/lib/format'
import { cn } from '@/lib/utils'

const METHOD_LABEL: Record<string, string> = { card: 'Card', check: 'Check', cash: 'Cash', ach: 'ACH' }

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { store, recordPayment } = useData()
  const inv = store.invoices.find((i) => i.id === id)
  const [linkSent, setLinkSent] = useState(false)

  const contact = inv ? store.contacts.find((c) => c.id === inv.contactId) : null

  if (!inv) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
        <Link href="/invoices" className="text-sm text-primary underline">Back to invoices</Link>
      </div>
    )
  }

  const paid = invoiceRepo.paid(inv)
  const balance = invoiceRepo.balance(inv)

  return (
    <div>
      <PageHeader
        title={`Invoice ${inv.number}`}
        description={contact?.name}
        actions={
          <button onClick={() => router.back()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </button>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Bill to</p>
                <p className="mt-1 font-semibold text-foreground">{contact?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {contact?.address}
                  <br />
                  {contact?.city}, AL {contact?.zip}
                </p>
              </div>
              <StatusChip kind="invoice" value={inv.status} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-4">
              <Meta label="Issued" value={shortDate(inv.issuedAt)} />
              <Meta label="Due" value={shortDate(inv.dueAt)} />
              <Meta label="Total" value={currency(inv.total)} />
              <Meta label="Balance" value={currency(balance)} emphasize={balance > 0} />
            </div>
          </Card>

          {/* Payment records */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Payments</h2>
            </div>
            {inv.payments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {currency(p.amount)}{' '}
                        <span className="font-normal text-muted-foreground">· {METHOD_LABEL[p.method]}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {longDateTime(p.date)}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3 text-sm">
              <span className="text-muted-foreground">Paid to date</span>
              <span className="font-semibold tabular-nums text-foreground">{currency(paid)}</span>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Collect payment</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Text a secure payment link straight to the customer&apos;s phone.
            </p>
            <div className="space-y-2">
              <Button
                className="w-full"
                disabled={balance <= 0}
                onClick={() => setLinkSent(true)}
              >
                <MessageSquare className="mr-1.5 h-4 w-4" />
                {linkSent ? 'Payment link sent' : 'Text payment link'}
              </Button>
              {linkSent && balance > 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    recordPayment(inv.id, balance)
                    setLinkSent(false)
                  }}
                >
                  <CreditCard className="mr-1.5 h-4 w-4" /> Simulate payment received
                </Button>
              )}
              {balance <= 0 && (
                <p className="rounded-md bg-success/10 px-3 py-2 text-center text-sm font-medium text-success">
                  Paid in full
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5 text-sm">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Aging</h3>
            <p className="text-muted-foreground">
              This invoice is in the{' '}
              <span className="font-medium text-foreground">
                {inv.status === 'paid' ? 'paid' : invoiceRepo.agingBucket(inv, store.invoices.length ? new Date().toISOString() : '')}
              </span>{' '}
              bucket.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 font-medium tabular-nums', emphasize ? 'text-destructive' : 'text-foreground')}>{value}</p>
    </div>
  )
}
