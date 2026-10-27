import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Bell,
  CloudRain,
  Cpu,
  Droplets,
  FlaskConical,
  Gift,
  HandCoins,
  HardHat,
  LayoutDashboard,
  Map,
  Menu,
  Settings,
  Siren,
  Users,
  Waves,
  X,
  OctagonX,
  SlidersHorizontal,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useMe, useMyNotifications } from '../store/hooks'
import { can } from '../domain/rbac'
import { RAIN_LABEL } from '../sim/engine'
import { Logo } from './Logo'
import type { User } from '../domain/types'

interface NavItem {
  to: string
  label: string
  short?: string
  Icon: typeof Bell
  show?: (u: User) => boolean
}

export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', short: 'Home', Icon: LayoutDashboard },
  { to: '/tanks', label: 'My Tanks', short: 'Tanks', Icon: Droplets },
  { to: '/drains', label: 'Drain Monitoring', short: 'Drains', Icon: Waves },
  { to: '/leaks', label: 'Leak Detection', Icon: Siren },
  { to: '/map', label: 'Map & Reports', short: 'Map', Icon: Map },
  { to: '/community', label: 'Community Action', short: 'Community', Icon: Users },
  { to: '/rewards', label: 'Rewards', Icon: Gift },
  { to: '/rebates', label: 'Water Rebates', Icon: HandCoins },
  { to: '/maintenance', label: 'Maintenance', Icon: HardHat, show: (u) => can(u, 'maintenance:view') },
  { to: '/prototype', label: 'Tatil Prototype', Icon: Cpu },
  { to: '/demo', label: 'Demo Controls', Icon: SlidersHorizontal },
  { to: '/notifications', label: 'Notifications', Icon: Bell },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

const MOBILE_TABS = ['/dashboard', '/tanks', '/map', '/community']

function RoleSwitcher({ compact }: { compact?: boolean }) {
  const users = useStore((s) => s.users)
  const setUser = useStore((s) => s.setUser)
  const me = useMe()
  const personas = users.filter((u) => !u.disabled || u.id === me.id)
  return (
    <label className={`flex items-center gap-2 ${compact ? '' : 'w-full'}`}>
      <span className="sr-only">Viewing as</span>
      <select
        className={`min-h-10 rounded-xl border border-white/15 bg-white/10 px-2.5 text-[13px] font-semibold text-white outline-none focus:ring-2 focus:ring-teal-400 ${compact ? 'max-w-[9.5rem]' : 'w-full'}`}
        value={me.id}
        onChange={(e) => setUser(e.target.value)}
      >
        {personas.map((u) => (
          <option key={u.id} value={u.id} className="text-ink">
            {u.name.split(' ')[0]} ({u.role === 'maintenance' ? 'Maintenance' : u.role === 'admin' ? 'Admin' : 'Resident'})
          </option>
        ))}
      </select>
    </label>
  )
}

function DemoBanner() {
  const sim = useStore((s) => s.sim)
  const liveSource = sim.dataSource === 'live'
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-[12px] font-bold text-navy-950" role="status">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>
        DEMO DATA · fictional records and {liveSource ? 'mostly simulated' : 'simulated'} sensor readings · not sent to any authority
      </span>
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const me = useMe()
  const { unread } = useMyNotifications()
  const sim = useStore((s) => s.sim)
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [loc.pathname])
  const items = NAV.filter((n) => !n.show || n.show(me))

  return (
    <div className="min-h-dvh">
      <DemoBanner />
      {sim.emergencyStop && (
        <div className="flex items-center justify-center gap-2 bg-danger-700 px-3 py-1.5 text-[12px] font-bold text-white" role="alert">
          <OctagonX className="size-4" aria-hidden /> EMERGENCY STOP ENGAGED – all tank releases disabled
        </div>
      )}
      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-navy-900 text-white lg:flex">
          <Link to="/" className="flex items-center gap-2.5 px-5 pb-4 pt-5" aria-label="IFRS home">
            <Logo className="size-10" />
            <div>
              <div className="display text-xl leading-none">IFRS</div>
              <div className="text-[11px] text-white/60">Integrated Flood Resilience</div>
            </div>
          </Link>
          <div className="px-4 pb-3">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/50">Viewing as</div>
            <RoleSwitcher />
          </div>
          <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
            {items.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `mb-0.5 flex min-h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition ${isActive ? 'bg-white text-navy-900' : 'text-white/80 hover:bg-white/10 hover:text-white'}`
                }
              >
                <Icon className="size-[18px]" aria-hidden />
                <span className="flex-1">{label}</span>
                {to === '/notifications' && unread > 0 && <span className="rounded-full bg-danger-500 px-1.5 text-[11px] font-bold text-white">{unread}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/50">
            <div className="flex items-center gap-1.5">
              <CloudRain className="size-3.5" aria-hidden /> Weather (simulated): {RAIN_LABEL[sim.rain]}
            </div>
            <div className="mt-1">Group 4 · Department of Dry Affairs</div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile header */}
          <header className="sticky top-0 z-[500] flex items-center gap-2 bg-navy-900 px-4 py-2.5 text-white lg:hidden">
            <Link to="/" className="flex items-center gap-2" aria-label="IFRS home">
              <Logo className="size-8" />
              <span className="display text-lg">IFRS</span>
            </Link>
            <div className="ml-auto flex items-center gap-1.5">
              <RoleSwitcher compact />
              <Link to="/notifications" className="relative grid size-10 place-items-center rounded-xl hover:bg-white/10" aria-label={`Notifications, ${unread} unread`}>
                <Bell className="size-5" />
                {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-danger-500 px-1 text-center text-[10px] font-bold leading-4">{unread}</span>}
              </Link>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl overflow-x-clip px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">{children}</main>
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-[600] border-t border-navy-100 bg-white/95 backdrop-blur lg:hidden" aria-label="Quick navigation">
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map((to) => {
            const n = NAV.find((x) => x.to === to)!
            return (
              <NavLink key={to} to={to} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-teal-700' : 'text-muted'}`}>
                <n.Icon className="size-5" aria-hidden />
                {n.short ?? n.label}
              </NavLink>
            )
          })}
          <button onClick={() => setOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted" aria-expanded={open}>
            <Menu className="size-5" aria-hidden />
            More
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-[700] lg:hidden" role="dialog" aria-modal="true" aria-label="All sections">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="display text-2xl text-navy-900">All sections</div>
              <button className="grid size-10 place-items-center rounded-full hover:bg-sand-100" onClick={() => setOpen(false)} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {items.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-center text-[12px] font-semibold ${isActive ? 'bg-navy-900 text-white' : 'bg-sand-50 text-navy-900'}`}>
                  <Icon className="size-5" aria-hidden />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
