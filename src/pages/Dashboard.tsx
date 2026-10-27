import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CalendarCheck, Cpu, Droplets, Gift, HandCoins, HardHat, Siren, Waves, ArrowRight, CloudRain, Database } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe, useMyNotifications, useNow, useVisibleTanks } from '../store/hooks'
import { useMapPoints } from '../store/mapPoints'
import { can } from '../domain/rbac'
import { deviceHealth, drainStatus, fmtL, percentFull, tankStatus, timeAgo } from '../domain/calc'
import { isLeakOpen } from '../domain/leak'
import { lifetimeEarned } from '../domain/rewards'
import { RAIN_LABEL } from '../sim/engine'
import { PageHeader, Section, StatCard, StatusBadge, Tag, SimTag, LiveTag } from '../components/ui'
import { TankGraphic } from '../components/TankGraphic'
import { AssetMap, type MapAssetType } from '../components/AssetMap'
import { Sparkline } from '../components/Charts'
import type { Status, Tank } from '../domain/types'

const STATUSES: (Status | 'all')[] = ['all', 'normal', 'monitor', 'warning', 'critical', 'offline', 'inspect']

export default function Dashboard() {
  const me = useMe()
  const now = useNow(3000)
  const s = useStore()
  const tanks = useVisibleTanks()
  const points = useMapPoints()
  const { list: notes } = useMyNotifications()
  const staff = can(me, 'tank:view-all')
  const [community, setCommunity] = useState('all')
  const [assetType, setAssetType] = useState<'all' | MapAssetType>('all')
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d')
  const since = now - { '24h': 1, '7d': 7, '30d': 30 }[range] * 86_400_000

  const buildingCommunity = (t: Tank) => s.buildings.find((b) => b.id === t.buildingId)?.communityId
  const fTanks = tanks.filter((t) => (community === 'all' || buildingCommunity(t) === community) && (status === 'all' || tankStatus(t, s.devices.find((d) => d.id === t.levelDeviceId), now) === status))
  const fDrains = s.drains.filter((d) => (community === 'all' || d.communityId === community) && (status === 'all' || drainStatus(d, s.devices.find((x) => x.id === d.deviceId), now) === status))

  const totalStored = fTanks.reduce((a, t) => a + (deviceHealth(s.devices.find((d) => d.id === t.levelDeviceId), now) === 'offline' ? 0 : t.volumeL), 0)
  const totalCap = fTanks.reduce((a, t) => a + t.capacityL, 0)
  const nearCap = fTanks.filter((t) => percentFull(t.volumeL, t.capacityL) >= t.highThresholdPct)
  const elevated = fDrains.filter((d) => ['warning', 'critical'].includes(drainStatus(d, s.devices.find((x) => x.id === d.deviceId), now)))
  const visibleTankIds = new Set(tanks.map((t) => t.id))
  const leaks = s.leaks.filter((l) => isLeakOpen(l.status) && visibleTankIds.has(l.tankId))
  const myDeviceIds = new Set(staff ? s.devices.map((d) => d.id) : s.devices.filter((d) => visibleTankIds.has(d.assetId)).map((d) => d.id))
  const badDevices = s.devices.filter((d) => myDeviceIds.has(d.id) && ['offline', 'fault', 'stale'].includes(deviceHealth(d, now)))
  const openTasks = s.tasks.filter((t) => !['done', 'cancelled'].includes(t.status))
  const events = s.events.filter((e) => e.start >= since || e.end >= since)
  const participants = events.reduce((a, e) => a + e.verified.length, 0)
  const registrations = s.events.filter((e) => !e.completed && e.end > now).reduce((a, e) => a + e.registrations.length, 0)
  const txs = s.pointsTx.filter((t) => t.t >= since && (staff || t.userId === me.id))
  const earned = txs.filter((t) => t.kind === 'earn').reduce((a, t) => a + t.delta, 0)
  const redeemed = -txs.filter((t) => t.kind === 'redeem').reduce((a, t) => a + t.delta, 0)
  const apps = s.applications.filter((a) => staff || a.userId === me.id)
  const pendingApps = apps.filter((a) => ['submitted', 'under_review', 'info_required'].includes(a.status))
  const collected = fTanks.reduce((a, t) => a + t.collectedL, 0)
  const filteredPoints = points.filter((p) => (assetType === 'all' || p.type === assetType) && (status === 'all' || p.status === status))

  const featured = useMemo(() => {
    const own = tanks.filter((t) => t.ownerId === me.id)
    return (own.length ? own : tanks).slice(0, 4)
  }, [tanks, me.id])
  const anyLive = s.devices.some((d) => d.source === 'live')

  return (
    <div>
      <PageHeader
        eyebrow={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${me.name.split(' ')[0]}`}
        title={staff ? 'System overview' : 'Your water at a glance'}
        actions={
          <div className="flex items-center gap-2">
            <Tag tone="navy" icon={<CloudRain className="size-3.5" aria-hidden />}>
              {RAIN_LABEL[s.sim.rain]} (sim)
            </Tag>
            {anyLive ? <LiveTag /> : <SimTag />}
          </div>
        }
      >
        {staff ? 'Every registered tank, drain, alert and community action across the pilot area.' : 'Your registered tanks, nearby drains and community activity. Readings update every few seconds.'}
      </PageHeader>

      {/* Filters */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Filters">
        <select className="input w-auto min-w-40" value={community} onChange={(e) => setCommunity(e.target.value)} aria-label="Community">
          <option value="all">All communities</option>
          {s.communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={assetType} onChange={(e) => setAssetType(e.target.value as never)} aria-label="Asset type (map)">
          <option value="all">All asset types</option>
          <option value="tank">Tanks</option>
          <option value="drain">Drains</option>
          <option value="report">Reports</option>
          <option value="event">Cleanups</option>
          {can(me, 'maintenance:view') && <option value="task">Maintenance</option>}
        </select>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as never)} aria-label="Status">
          {STATUSES.map((x) => (
            <option key={x} value={x}>
              {x === 'all' ? 'Any status' : x === 'inspect' ? 'Needs inspection' : x[0].toUpperCase() + x.slice(1)}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={range} onChange={(e) => setRange(e.target.value as never)} aria-label="Date range">
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard to="/tanks" icon={<Droplets className="size-5" />} label="Registered tanks" value={fTanks.length} sub={`${fmtL(totalCap)} total capacity`} tone="teal" />
        <StatCard to="/tanks" icon={<Database className="size-5" />} label="Water stored (measured)" value={fmtL(totalStored)} sub={`${totalCap ? Math.round((totalStored / totalCap) * 100) : 0}% of capacity · offline tanks excluded`} tone="teal" />
        <StatCard to="/tanks" icon={<Droplets className="size-5" />} label="Approaching capacity" value={nearCap.length} sub={nearCap.map((t) => t.name).slice(0, 2).join(', ') || 'None'} tone={nearCap.length ? 'amber' : 'green'} />
        <StatCard to="/drains" icon={<Waves className="size-5" />} label="Drains elevated" value={elevated.length} sub={elevated.map((d) => d.name).slice(0, 2).join(', ') || 'All within range'} tone={elevated.length ? 'red' : 'green'} />
        <StatCard to="/leaks" icon={<Siren className="size-5" />} label="Suspected leaks" value={leaks.length} sub={leaks.length ? 'Open alerts need attention' : 'No open alerts'} tone={leaks.length ? 'amber' : 'green'} />
        <StatCard to={can(me, 'admin:devices') ? '/settings/devices' : '/tanks'} icon={<Cpu className="size-5" />} label="Devices offline / faulty" value={badDevices.length} sub={badDevices.slice(0, 2).map((d) => d.id).join(', ') || 'All reporting'} tone={badDevices.length ? 'amber' : 'green'} />
        {can(me, 'maintenance:view') && <StatCard to="/maintenance" icon={<HardHat className="size-5" />} label="Open maintenance tasks" value={openTasks.length} sub={`${openTasks.filter((t) => t.priority === 'high').length} high priority`} tone="navy" />}
        <StatCard to="/community" icon={<CalendarCheck className="size-5" />} label="Cleanup participation" value={participants} sub={`verified in range · ${registrations} registered for upcoming`} tone="navy" />
        <StatCard to="/rewards" icon={<Gift className="size-5" />} label={staff ? 'Points issued / redeemed' : 'Your points earned'} value={staff ? `${earned} / ${redeemed}` : lifetimeEarned(s.pointsTx, me.id)} sub={staff ? 'in selected range' : `${redeemed} redeemed in range`} tone="green" />
        <StatCard to="/rebates" icon={<HandCoins className="size-5" />} label="Rebate claims" value={apps.length} sub={`${pendingApps.length} pending · ${fmtL(collected)} rainwater collected (est.)`} tone="navy" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Map: assets & verified reports" action={<Link to="/map" className="text-[13px] font-semibold text-teal-700">Full map →</Link>}>
          <AssetMap points={filteredPoints} height={330} />
        </Section>
        <Section title={staff ? 'Featured tanks' : 'My tanks'} action={<Link to="/tanks" className="text-[13px] font-semibold text-teal-700">All →</Link>}>
          <div className="space-y-2">
            {featured.map((t) => {
              const dev = s.devices.find((d) => d.id === t.levelDeviceId)
              const st = tankStatus(t, dev, now)
              const off = st === 'offline'
              const v = s.valves.find((x) => x.id === t.valveId)
              return (
                <Link key={t.id} to={`/tanks/${t.id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-sand-50">
                  <TankGraphic pct={percentFull(t.volumeL, t.capacityL)} highPct={t.highThresholdPct} size="sm" offline={off} releasing={v?.state === 'open'} label={t.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-navy-900">{t.name}</div>
                    <div className="text-xs text-muted">{off ? `Last reading ${timeAgo(t.lastReadingAt, now)} – unavailable` : `${fmtL(t.volumeL)} of ${fmtL(t.capacityL)} · ${timeAgo(t.lastReadingAt, now)}`}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={st} />
                      {v && <Tag tone={v.state === 'open' || v.state === 'opening' ? 'teal' : 'gray'}>Valve {v.state}</Tag>}
                      {dev?.source === 'live' && <LiveTag />}
                    </div>
                  </div>
                  <div className="hidden w-20 sm:block">{!off && <Sparkline data={t.history} />}</div>
                </Link>
              )
            })}
          </div>
        </Section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Section title="Drain levels" action={<Link to="/drains" className="text-[13px] font-semibold text-teal-700">All drains →</Link>}>
          <ul className="divide-y divide-sand-100">
            {fDrains
              .slice()
              .sort((a, b) => b.levelCm / b.criticalCm - a.levelCm / a.criticalCm)
              .slice(0, 5)
              .map((d) => {
                const dev = s.devices.find((x) => x.id === d.deviceId)
                const st = drainStatus(d, dev, now)
                return (
                  <li key={d.id}>
                    <Link to={`/drains/${d.id}`} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-navy-900">{d.name}</div>
                        <div className="text-xs text-muted">{st === 'offline' ? `No data since ${timeAgo(d.lastReadingAt, now)}` : `${d.levelCm.toFixed(0)} cm · elevated at ${d.elevatedCm} cm`}</div>
                      </div>
                      <StatusBadge status={st} />
                    </Link>
                  </li>
                )
              })}
          </ul>
        </Section>
        <Section title="Latest alerts" action={<Link to="/notifications" className="text-[13px] font-semibold text-teal-700">All →</Link>}>
          {notes.length === 0 ? (
            <p className="text-sm text-muted">No notifications.</p>
          ) : (
            <ul className="space-y-2">
              {notes.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <Link to={n.link ?? '/notifications'} className="flex gap-3 rounded-xl p-2 hover:bg-sand-50">
                    <Bell className={`mt-0.5 size-4 shrink-0 ${n.severity === 'critical' ? 'text-danger-500' : n.severity === 'warning' ? 'text-amber-500' : 'text-teal-600'}`} aria-hidden />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-navy-900">
                        <span className="sr-only">{n.severity}: </span>
                        {n.title}
                      </div>
                      <div className="line-clamp-1 text-xs text-muted">
                        {timeAgo(n.t, now)} · {n.body}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Link to="/prototype" className="mt-5 flex items-center gap-4 overflow-hidden rounded-2xl bg-navy-900 p-5 text-white">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-400 text-navy-950">
          <Cpu className="size-6" />
        </div>
        <div className="flex-1">
          <div className="display text-xl">Tatil prototype station</div>
          <div className="text-sm text-white/70">See the demonstration tank and drain sensor near the Tatil Building, and how the Arduino connects.</div>
        </div>
        <ArrowRight className="size-5" />
      </Link>
    </div>
  )
}
