'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HardHat, Building2, Headset, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useAuth, type Role, roleLabels } from '@/src/lib/auth'
import { cn } from '@/lib/utils'

const roleOptions: { role: Role; icon: typeof Building2; blurb: string }[] = [
  { role: 'owner', icon: Building2, blurb: 'Full visibility: pipeline, revenue, crews' },
  { role: 'office', icon: Headset, blurb: 'Sales, scheduling, invoicing & inbox' },
  { role: 'field', icon: HardHat, blurb: 'Today’s jobs, checklists & photos' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('dale@summitridgeroofing.com')
  const [password, setPassword] = useState('demo')
  const [role, setRole] = useState<Role>('owner')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    login(email, role)
    router.push(role === 'field' ? '/field' : '/dashboard')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HardHat className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold">Janus</div>
            <div className="text-xs text-sidebar-foreground/60">Home-service CRM</div>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-2xl font-semibold leading-snug text-balance">
            The command center for roofing, HVAC &amp; plumbing crews.
          </h2>
          <p className="mt-3 text-sm text-sidebar-foreground/70 text-pretty">
            Sales pipeline, production boards, scheduling, invoicing, a unified inbox, and an AI receptionist that
            answers every call — in one place.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              ['40', 'Customers'],
              ['25', 'Active jobs'],
              ['$1.2M', 'Pipeline'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-xl font-semibold text-primary">{n}</div>
                <div className="text-xs text-sidebar-foreground/60">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/50">Summit Ridge Roofing — Birmingham, AL</p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <HardHat className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold">Janus</span>
            </div>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to Summit Ridge Roofing. Any credentials work in this demo.</p>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <div className="space-y-1.5">
              <Label>Sign in as</Label>
              <div className="grid gap-2">
                {roleOptions.map((opt) => {
                  const Icon = opt.icon
                  const active = role === opt.role
                  return (
                    <button
                      type="button"
                      key={opt.role}
                      onClick={() => setRole(opt.role)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                        active ? 'border-primary bg-accent' : 'border-border hover:bg-muted',
                      )}
                    >
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{roleLabels[opt.role]}</span>
                        <span className="block truncate text-xs text-muted-foreground">{opt.blurb}</span>
                      </span>
                      <span className={cn('h-4 w-4 rounded-full border-2', active ? 'border-primary bg-primary' : 'border-border')} />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <Button type="submit" size="lg" className="mt-6 w-full">
            Sign in <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
