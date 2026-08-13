import { Phone, MessageSquare, Mail, FileText, Calendar, Package, Receipt, Check } from 'lucide-react'
import { agentKindMeta } from '@/src/lib/format'

const iconMap = {
  phone: Phone,
  message: MessageSquare,
  mail: Mail,
  file: FileText,
  calendar: Calendar,
  package: Package,
  receipt: Receipt,
  check: Check,
}

export function AgentKindIcon({ kind, className }: { kind: string; className?: string }) {
  const meta = agentKindMeta[kind] ?? agentKindMeta.task
  const Icon = iconMap[meta.icon]
  return <Icon className={className} />
}
