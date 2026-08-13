import { cn } from '@/lib/utils'

export function Avatar({
  initials,
  color,
  size = 'md',
  className,
  title,
}: {
  initials: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  title?: string
}) {
  const sizes = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-11 w-11 text-sm',
  }
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color ?? 'var(--primary)' }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
