'use client'

import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shell/app-shell'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusChip } from '@/components/ui/status-chip'
import { Card } from '@/components/ui/card'
import { useData } from '@/src/lib/data/provider'
import { invoiceRepo } from '@/src/lib/data/repositories'
import { currency, shortDate } from '@/src/lib/format'
import type { Invoice } from '@/src/lib/data/types'
import { cn } from '@/lib/utils'

const BUCKETS = [
  { key: 'current', label: 'Current' },
  { key: '1-30', label: '1–30 days' },
  { key: '31-60', label: '31–60 days' },
  { key: '60+', label: '60+ days' },
] as const

export default function InvoicesPage() {
  const { store, now } = useData()
  const router = useRouter()

  const contactName = (id: string) => store.contacts.find((c) => c.id === id)?.name ?? 'Unknown'

  const bucketTotals = BUCKETS.map((b) => {
    const invs = store.invoices.filter(
      (i) => i.status !== 'paid' && invoiceRepo.agingBucket(i, now) === b.key,
    )
    return {
      ...b,
      amount: invs.reduce((sum, i) => sum + invoiceRepo.balance(i), 0),
      count: invs.length,
    }
  })

  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice',
      sortable: true,
      sortValue: (i) => i.number,
      render: (i) => <span className="font-medium text-foreground">{i.number}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      sortValue: (i) => contactName(i.contactId),
      render: (i) => <span className="text-foreground">{contactName(i.contactId)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (i) => i.status,
      render: (i) => <StatusChip kind="invoice" value={i.status} />,
    },
    {
      key: 'due',
      header: 'Due',
      className: 'hidden md:table-cell',
      sortable: true,
      sortValue: (i) => i.dueAt,
      render: (i) => <span className="text-muted-foreground">{shortDate(i.dueAt)}</span>,
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      sortable: true,
      sortValue: (i) => invoiceRepo.balance(i),
      render: (i) => (
        <span className={cn('font-medium tabular-nums', invoiceRepo.balance(i) > 0 ? 'text-foreground' : 'text-muted-foreground')}>
          {currency(invoiceRepo.balance(i))}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortable: true,
      sortValue: (i) => i.total,
      render: (i) => <span className="tabular-nums text-muted-foreground">{currency(i.total)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader title="Invoices" description={`${store.invoices.length} invoices`} />
      <div className="space-y-5 px-4 py-4 sm:px-6">
        {/* Aging buckets */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {bucketTotals.map((b) => (
            <Card key={b.key} className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{b.label}</p>
              <p className={cn('mt-1 text-xl font-bold tabular-nums', b.key !== 'current' && b.amount > 0 ? 'text-destructive' : 'text-foreground')}>
                {currency(b.amount)}
              </p>
              <p className="text-xs text-muted-foreground">{b.count} open</p>
            </Card>
          ))}
        </div>

        <DataTable
          rows={store.invoices}
          columns={columns}
          search
          searchKeys={(i) => `${i.number} ${contactName(i.contactId)} ${i.status}`}
          onRowClick={(i) => router.push(`/invoices/${i.id}`)}
          initialSort={{ key: 'due', dir: 'asc' }}
        />
      </div>
    </div>
  )
}
