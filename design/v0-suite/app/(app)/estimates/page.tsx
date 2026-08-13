'use client'

import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shell/app-shell'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusChip } from '@/components/ui/status-chip'
import { useData } from '@/src/lib/data/provider'
import { estimateTotals } from '@/src/lib/data/repositories'
import { currency, shortDate } from '@/src/lib/format'
import type { Estimate } from '@/src/lib/data/types'

export default function EstimatesPage() {
  const { store } = useData()
  const router = useRouter()

  const contactName = (id: string) => store.contacts.find((c) => c.id === id)?.name ?? 'Unknown'

  const columns: Column<Estimate>[] = [
    {
      key: 'number',
      header: 'Estimate',
      sortable: true,
      sortValue: (e) => e.number,
      render: (e) => <span className="font-medium text-foreground">{e.number}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      sortValue: (e) => contactName(e.contactId),
      render: (e) => <span className="text-foreground">{contactName(e.contactId)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (e) => e.status,
      render: (e) => <StatusChip kind="estimate" value={e.status} />,
    },
    {
      key: 'created',
      header: 'Created',
      className: 'hidden md:table-cell',
      sortable: true,
      sortValue: (e) => e.createdAt,
      render: (e) => <span className="text-muted-foreground">{shortDate(e.createdAt)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortable: true,
      sortValue: (e) => estimateTotals(e).total,
      render: (e) => <span className="font-medium tabular-nums">{currency(estimateTotals(e).total)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader title="Estimates" description={`${store.estimates.length} estimates`} />
      <div className="px-4 py-4 sm:px-6">
        <DataTable
          rows={store.estimates}
          columns={columns}
          search
          searchKeys={(e) => `${e.number} ${contactName(e.contactId)} ${e.status}`}
          onRowClick={(e) => router.push(`/estimates/${e.id}`)}
          initialSort={{ key: 'created', dir: 'desc' }}
        />
      </div>
    </div>
  )
}
