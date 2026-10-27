import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TriangleAlert } from 'lucide-react'
import { useStore } from '../store/store'
import { useNow } from '../store/hooks'
import { accelFor, basketOverdue, blockageSignals, drainStatus, rateOfRise, timeAgo } from '../domain/calc'
import { PageHeader, Progress, SimTag, LiveTag, StatusBadge, Tag } from '../components/ui'
import { Sparkline } from '../components/Charts'

export default function Drains() {
  const now = useNow(3000)
  const drains = useStore((s) => s.drains)
  const devices = useStore((s) => s.devices)
  const communities = useStore((s) => s.communities)
  const rain = useStore((s) => s.sim.rain)
  const [community, setCommunity] = useState('all')
  const list = drains.filter((d) => community === 'all' || d.communityId === community)
  return (
    <div>
      <PageHeader eyebrow="Feature 2" title="Drain monitoring">
        Water level in monitored storm drains, how fast it is rising, and basket maintenance. Possible blockages are always shown as <em>suspected</em> until a crew inspects them.
      </PageHeader>
      <select className="input mb-4 w-auto" value={community} onChange={(e) => setCommunity(e.target.value)} aria-label="Community filter">
        <option value="all">All communities</option>
        {communities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.pilot ? ' (pilot)' : ''}
          </option>
        ))}
      </select>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((d) => {
          const dev = devices.find((x) => x.id === d.deviceId)
          const st = drainStatus(d, dev, now)
          const off = st === 'offline'
          const rise = rateOfRise(d.history, 15, accelFor(dev))
          const block = off ? [] : blockageSignals(d, rain, now, accelFor(dev))
          const pct = (d.levelCm / d.rangeCm) * 100
          return (
            <Link key={d.id} to={`/drains/${d.id}`} className="card block min-w-0 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold text-navy-900">{d.name}</div>
                  <div className="text-xs text-muted">
                    {d.id.toUpperCase()} · {communities.find((c) => c.id === d.communityId)?.name}
                  </div>
                </div>
                <StatusBadge status={st} />
              </div>
              <div className={`mt-3 ${off ? 'opacity-40' : ''}`}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold tabular-nums text-navy-900">{off ? '—' : `${d.levelCm.toFixed(0)} cm`}</span>
                  <span className="text-xs text-muted">
                    elevated {d.elevatedCm} · critical {d.criticalCm} cm
                  </span>
                </div>
                <Progress value={pct} tone={st === 'critical' ? 'red' : st === 'warning' ? 'amber' : 'teal'} label={`${d.name} level`} />
                <div className="mt-2 h-8">{!off && <Sparkline data={d.history} color={st === 'critical' ? '#d62839' : st === 'warning' ? '#e39a1b' : '#1fa597'} />}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {off ? <Tag tone="gray">No data {timeAgo(d.lastReadingAt, now)}</Tag> : <Tag tone="navy" icon={<TrendingUp className="size-3" />}>{rise === null ? '—' : `${rise >= 0 ? '+' : ''}${rise.toFixed(2)} cm/min`}</Tag>}
                {dev?.source === 'live' ? <LiveTag /> : <SimTag />}
                {basketOverdue(d, now) && <Tag tone="amber">Basket overdue</Tag>}
                {block.length > 0 && !d.blockageConfirmed && <Tag tone="red" icon={<TriangleAlert className="size-3" />}>Suspected blockage</Tag>}
                {d.blockageConfirmed && <Tag tone="red">Blockage confirmed</Tag>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
