import type * as React from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' | 'destructive'

const variants: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground border-transparent',
  secondary: 'bg-secondary text-secondary-foreground border-transparent',
  outline: 'text-foreground border-border',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/20 text-warning-foreground border-warning/40',
  info: 'bg-info/15 text-info border-info/30',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
