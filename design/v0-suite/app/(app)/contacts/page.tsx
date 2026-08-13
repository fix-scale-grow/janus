'use client'

import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shell/app-shell'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useData } from '@/src/lib/data/provider'
import { currency, formatPhoneMaybe, sourceLabel } from '@/src/lib/format'
import type { Contact } from '@/src/lib/data/types'

export default function ContactsPage() {
  const { store } = useData()
  const router = useRouter()

  const jobCount = (id: string) => store.jobs.filter((j) => j.contactId === id).length

  const columns: Column<Contact>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (c) => c.name,
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            initials={c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            size="sm"
          />
          <div>
            <p className="font-medium text-foreground">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.city}, AL</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (c) => <span className="text-muted-foreground">{formatPhoneMaybe(c.phone)}</span> },
    { key: 'email', header: 'Email', className: 'hidden md:table-cell', render: (c) => <span className="text-muted-foreground">{c.email}</span> },
    {
      key: 'jobs',
      header: 'Jobs',
      sortable: true,
      align: 'right',
      sortValue: (c) => jobCount(c.id),
      render: (c) => <span className="tabular-nums">{jobCount(c.id)}</span>,
    },
    {
      key: 'ltv',
      header: 'Lifetime value',
      sortable: true,
      align: 'right',
      sortValue: (c) => c.lifetimeValue,
      render: (c) => <span className="font-medium tabular-nums">{currency(c.lifetimeValue)}</span>,
    },
    {
      key: 'source',
      header: 'Source',
      className: 'hidden lg:table-cell',
      render: (c) => <Badge variant="outline">{sourceLabel(c.source)}</Badge>,
    },
  ]

  return (
    <div>
      <PageHeader title="Contacts" description={`${store.contacts.length} customers`} />
      <div className="px-4 py-4 sm:px-6">
        <DataTable
          rows={store.contacts}
          columns={columns}
          search
          searchKeys={(c) => `${c.name} ${c.city} ${c.phone} ${c.email} ${c.source}`}
          onRowClick={(c) => router.push(`/contacts/${c.id}`)}
          initialSort={{ key: 'ltv', dir: 'desc' }}
        />
      </div>
    </div>
  )
}
