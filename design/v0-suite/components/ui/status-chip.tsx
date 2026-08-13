import { cn } from '@/lib/utils'
import type { EstimateStatus, InvoiceStatus } from '@/src/lib/data/types'

const ESTIMATE: Record<EstimateStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  sent: { label: 'Sent', className: 'bg-info/15 text-info border-info/30' },
  viewed: { label: 'Viewed', className: 'bg-accent text-accent-foreground border-primary/30' },
  signed: { label: 'Signed', className: 'bg-success/15 text-success border-success/30' },
  declined: { label: 'Declined', className: 'bg-destructive/10 text-destructive border-destructive/30' },
}

const INVOICE: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  sent: { label: 'Sent', className: 'bg-info/15 text-info border-info/30' },
  partial: { label: 'Partial', className: 'bg-accent text-accent-foreground border-primary/30' },
  paid: { label: 'Paid', className: 'bg-success/15 text-success border-success/30' },
  overdue: { label: 'Overdue', className: 'bg-destructive/10 text-destructive border-destructive/30' },
}

export function StatusChip({
  kind,
  value,
}: {
  kind: 'estimate' | 'invoice'
  value: EstimateStatus | InvoiceStatus
}) {
  const meta = kind === 'estimate' ? ESTIMATE[value as EstimateStatus] : INVOICE[value as InvoiceStatus]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}
