'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, Users, MessageSquareText, Plug, CheckCircle2, Circle, PhoneCall, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/shell/app-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { Tabs } from '@/components/ui/tabs'
import { useEmployees } from '@/src/lib/data/provider'
import { cn } from '@/lib/utils'

const roleBadge: Record<string, string> = {
  owner: 'bg-primary/15 text-primary',
  office: 'bg-info/10 text-info',
  field: 'bg-secondary text-secondary-foreground',
}

const A2P_STEPS = [
  { key: 'business', label: 'Business info', desc: 'Legal name, EIN, address, and website submitted to the carrier.' },
  { key: 'brand', label: 'Brand registration', desc: 'Your brand is vetted with The Campaign Registry (TCR).' },
  { key: 'campaign', label: 'Campaign registration', desc: 'Use case (customer care) and sample messages approved.' },
  { key: 'approved', label: 'Approved', desc: 'Your number can send A2P 10DLC traffic at full throughput.' },
]

export default function SettingsPage() {
  const employees = useEmployees()
  const [tab, setTab] = useState('company')
  const currentStep = A2P_STEPS.length - 1

  return (
    <div>
      <PageHeader title="Settings" description="Company profile, team, texting compliance, and integrations." />

      <div className="space-y-6 p-4 sm:p-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'company', label: 'Company', icon: <Building2 className="h-4 w-4" /> },
            { value: 'users', label: 'Users & Roles', icon: <Users className="h-4 w-4" /> },
            { value: 'phone', label: 'Phone & Texting', icon: <MessageSquareText className="h-4 w-4" /> },
            { value: 'integrations', label: 'Integrations', icon: <Plug className="h-4 w-4" /> },
          ]}
        />

        {tab === 'company' && (
          <Card className="max-w-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground">Company profile</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="cname">Company name</Label>
                <Input id="cname" defaultValue="Summit Ridge Roofing" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cphone">Main phone</Label>
                <Input id="cphone" defaultValue="(205) 555-8841" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cemail">Email</Label>
                <Input id="cemail" defaultValue="office@summitridgeroofing.com" className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="caddr">Address</Label>
                <Input id="caddr" defaultValue="1420 Montgomery Hwy, Birmingham, AL 35216" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="clicense">License #</Label>
                <Input id="clicense" defaultValue="AL-RC-88214" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ctax">Default tax rate</Label>
                <Input id="ctax" defaultValue="9.0%" className="mt-1" />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button>Save changes</Button>
            </div>
          </Card>
        )}

        {tab === 'users' && (
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Team ({employees.length})</h2>
              <Button size="sm" variant="outline">Invite user</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Title</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5 font-medium">Phone</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={e.initials} color={e.avatarColor} size="sm" />
                          <span className="font-medium text-foreground">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.title}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn('capitalize', roleBadge[e.role])}>{e.role}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{e.phone}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'phone' && (
          <div className="max-w-2xl space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">A2P 10DLC Registration</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Carriers require business texting numbers to be registered. Janus handled this for you.
                  </p>
                </div>
                <Badge className="bg-success/10 text-success">Approved</Badge>
              </div>

              <ol className="mt-5 space-y-4">
                {A2P_STEPS.map((step, i) => {
                  const done = i <= currentStep
                  return (
                    <li key={step.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        {done ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        {i < A2P_STEPS.length - 1 && (
                          <span className={cn('mt-1 h-8 w-px', done ? 'bg-success/40' : 'bg-border')} />
                        )}
                      </div>
                      <div className="pb-1">
                        <p className={cn('text-sm font-medium', done ? 'text-foreground' : 'text-muted-foreground')}>
                          {step.label}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>

              <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                Registered number <span className="font-medium text-foreground">(205) 555-8841</span> · Brand ID{' '}
                <span className="font-mono text-foreground">BXXXXX21</span> · Campaign{' '}
                <span className="font-mono text-foreground">CXXXXX09</span> · Throughput 4,500 msg/day
              </div>
            </Card>

            <Card className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <PhoneCall className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Phone Agent</p>
                  <p className="text-xs text-muted-foreground">Greeting script, booking rules, and escalation</p>
                </div>
              </div>
              <Link href="/phone-agent" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                Configure <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Card>
          </div>
        )}

        {tab === 'integrations' && (
          <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
            <IntegrationCard name="QuickBooks Online" desc="Sync invoices, payments, and customers to your books." status="connected" />
            <IntegrationCard name="ABC Supply" desc="Order shingles and materials directly from approved jobs." status="available" />
            <IntegrationCard name="SRS Distribution" desc="Live material pricing and delivery scheduling." status="available" />
            <IntegrationCard name="CompanyCam" desc="Field photos sync automatically to job records." status="connected" />
          </div>
        )}
      </div>
    </div>
  )
}

function IntegrationCard({ name, desc, status }: { name: string; desc: string; status: 'connected' | 'available' }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-secondary-foreground">
          {name.slice(0, 2)}
        </div>
        {status === 'connected' ? (
          <Badge className="bg-success/10 text-success">Connected</Badge>
        ) : (
          <Badge variant="secondary">Available</Badge>
        )}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{name}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{desc}</p>
      <Button variant={status === 'connected' ? 'outline' : 'default'} size="sm" className="mt-4 self-start">
        {status === 'connected' ? 'Manage' : 'Connect'}
      </Button>
    </Card>
  )
}
