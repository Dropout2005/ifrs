import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store/store'
import { useMe, useVisibleTanks } from '../store/hooks'
import { useMapPoints } from '../store/mapPoints'
import { can } from '../domain/rbac'
import { isLeakOpen } from '../domain/leak'
import { fundingCommitted } from '../domain/rebates'
import { fmtL, fmtTTD } from '../domain/calc'
import { AssetMap, type MapAssetType } from '../components/AssetMap'
import { PageHeader, Section, StatusBadge } from '../components/ui'
import { LevelChart } from '../components/Charts'
import type { Reading } from '../domain/types'

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const iso = (t: number) => new Date(t).toISOString()

export default function MapPage() {
  const me = useMe()
  const s = useStore()
  const tanks = useVisibleTanks()
  const points = useMapPoints()
  const staff = can(me, 'report:verify')
  const [types, setTypes] = useState<Record<MapAssetType, boolean>>({ tank: true, drain: true, report: true, event: true, task: true, site: true })
  const [community, setCommunity] = useState('all')
  const [days, setDays] = useState(30)
  const since = Date.now() - days * 86_400_000
  const visible = points.filter((p) => types[p.type])
  const [selected, setSelected] = useState<string | null>(null)

  // Aggregate stored water across visible tanks (hourly buckets, last 48 h).
  const storedSeries: Reading[] = useMemo(() => {
    const end = Date.now()
    const out: Reading[] = []
    for (let t = end - 48 * 3_600_000; t <= end; t += 3_600_000) {
      let sum = 0
      for (const tk of tanks) {
        const h = tk.history
        let v = h[0]?.v ?? 0
        for (const r of h) {
          if (r.t > t) break
          v = r.v
        }
        sum += v
      }
      out.push({ t, v: Math.round(sum) })
    }
    return out
  }, [tanks])

  const commOk = (cid?: string) => community === 'all' || cid === community
  const reportsInRange = s.reports.filter((r) => r.createdAt >= since && (staff || r.reporterId === me.id || ['verified', 'assigned', 'in_progress', 'resolved'].includes(r.status)))
  const byStatus = ['submitted', 'under_review', 'verified', 'assigned', 'in_progress', 'resolved'].map((st) => ({ name: st.replace('_', ' '), count: reportsInRange.filter((r) => r.status === st).length }))
  const valveOps = s.valves
    .filter((v) => tanks.some((t) => t.id === v.tankId))
    .map((v) => ({ name: tanks.find((t) => t.id === v.tankId)!.name.replace('Tank', 'T.'), opens: v.log.filter((l) => l.action === 'open' && l.t >= since).length, closes: v.log.filter((l) => l.action === 'close' && l.t >= since).length }))
  const visibleIds = new Set(tanks.map((t) => t.id))
  const leakRows = s.leaks.filter((l) => visibleIds.has(l.tankId) && l.detectedAt >= since)
  const resolved = leakRows.filter((l) => l.status === 'resolved')
  const avgRes = resolved.length ? resolved.reduce((a, l) => a + ((l.timeline[l.timeline.length - 1]?.t ?? l.detectedAt) - l.detectedAt), 0) / resolved.length / 3_600_000 : null
  const events = s.events.filter((e) => e.start >= since && commOk(e.communityId))
  const pts = s.pointsTx.filter((t) => t.t >= since && (staff || t.userId === me.id))
  const prog = s.programmes[0]

  return (
    <div>
      <PageHeader eyebrow="Maps & analytics" title="Map and reports">
        Registered assets, monitored drains, verified community reports and cleanups. Private household tanks are only shown to their owners and staff; public report locations are approximate.
      </PageHeader>

      <Section title="Interactive map">
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Layers">
          {(['tank', 'drain', 'report', 'event', ...(can(me, 'maintenance:view') ? ['task'] : [])] as MapAssetType[]).map((t) => (
            <label key={t} className={`chip cursor-pointer select-none ring-1 ring-inset ${types[t] ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-muted ring-navy-100'}`}>
              <input type="checkbox" className="sr-only" checked={types[t]} onChange={(e) => setTypes({ ...types, [t]: e.target.checked })} />
              {t === 'task' ? 'Maintenance' : t === 'event' ? 'Cleanups' : t[0].toUpperCase() + t.slice(1) + 's'}
            </label>
          ))}
        </div>
        <AssetMap points={visible} height={460} />
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-teal-700">List view ({visible.length} markers)</summary>
          <ul className="mt-2 divide-y divide-sand-100">
            {visible.map((p) => (
              <li key={`${p.type}-${p.id}`} className={`flex items-center gap-3 py-2 ${selected === p.id ? 'bg-teal-50' : ''}`} onClick={() => setSelected(p.id)}>
                <span className="w-24 text-xs font-bold uppercase text-muted">{p.type}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-navy-900">{p.link ? <Link to={p.link}>{p.title}</Link> : p.title}</div>
                  <div className="truncate text-xs text-muted">{p.detail}</div>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </details>
      </Section>

      <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-3">
        <h2 className="display text-3xl text-navy-900">Reports & analytics</h2>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto max-w-full" value={community} onChange={(e) => setCommunity(e.target.value)} aria-label="Community">
            <option value="all">All communities</option>
            {s.communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Date range">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={staff ? 'Total water stored (all tanks)' : 'Water stored in your visible tanks'} action={<CsvBtn onClick={() => downloadCsv('tank-readings.csv', [['tank_id', 'tank_name', 'timestamp', 'volume_l', 'capacity_l'], ...tanks.flatMap((t) => t.history.filter((r) => r.t >= since).map((r) => [t.id, t.name, iso(r.t), r.v, t.capacityL]))])} />}>
          <LevelChart data={storedSeries} unit="L" label="Stored water, hourly (sum of tank readings)" />
        </Section>
        <Section title="Valve operations" action={<CsvBtn onClick={() => downloadCsv('valve-log.csv', [['valve_id', 'timestamp', 'action', 'mode', 'by', 'reason'], ...s.valves.filter((v) => visibleIds.has(v.tankId)).flatMap((v) => v.log.filter((l) => l.t >= since).map((l) => [v.id, iso(l.t), l.action, l.mode, l.by, l.reason]))])} />}>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={valveOps} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e9ef" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="opens" name="Opened" fill="#1fa597" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closes" name="Closed" fill="#13315c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Drain water levels now" action={<CsvBtn onClick={() => downloadCsv('drain-readings.csv', [['drain_id', 'name', 'timestamp', 'level_cm'], ...s.drains.filter((d) => commOk(d.communityId)).flatMap((d) => d.history.filter((r) => r.t >= since).map((r) => [d.id, d.name, iso(r.t), r.v]))])} />}>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={s.drains.filter((d) => commOk(d.communityId)).map((d) => ({ name: d.name.split(' ').slice(0, 2).join(' '), level: Math.round(d.levelCm), elevated: d.elevatedCm }))} layout="vertical" margin={{ left: 10, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e3e9ef" />
                <XAxis type="number" domain={[0, 120]} tick={{ fontSize: 11 }} unit=" cm" />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="level" name="Level (cm)" fill="#1d4275" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Citizen reports by status" action={<CsvBtn onClick={() => downloadCsv('citizen-reports.csv', [['report_id', 'category', 'status', 'created', 'approx_lat', 'approx_lng', 'location'], ...reportsInRange.map((r) => [r.id, r.category, r.status, iso(r.createdAt), r.lat.toFixed(3), r.lng.toFixed(3), r.locationText])])} />}>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={byStatus} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e9ef" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="count" name="Reports" fill="#2ec4b6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted">CSV export omits reporter identity and rounds coordinates to ≈100 m.</p>
        </Section>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Leak incidents" value={leakRows.length} sub={`${leakRows.filter((l) => isLeakOpen(l.status)).length} open · avg resolution ${avgRes === null ? '—' : `${avgRes.toFixed(1)} h`}`} />
        <Metric label="Cleanup attendance" value={events.reduce((a, e) => a + e.verified.length, 0)} sub={`${events.length} events · ${events.reduce((a, e) => a + (e.wasteKg ?? 0), 0)} kg waste collected`} />
        <Metric label="Points issued / redeemed" value={`${pts.filter((p) => p.kind === 'earn').reduce((a, p) => a + p.delta, 0)} / ${-pts.filter((p) => p.kind === 'redeem').reduce((a, p) => a + p.delta, 0)}`} sub="verified activities only" />
        <Metric label="Rainwater collected (est.)" value={fmtL(tanks.reduce((a, t) => a + t.collectedL, 0))} sub="estimate from roof area × rainfall" />
        {can(me, 'rebate:review') && prog && <Metric label="Rebate commitments" value={fmtTTD(fundingCommitted(s.applications, prog.id))} sub={`of ${fmtTTD(prog.fundingCapTTD)} cap · ${s.applications.length} applications`} />}
      </div>
      {can(me, 'rebate:review') && (
        <button className="btn-ghost btn-sm mt-3" onClick={() => downloadCsv('rebate-applications.csv', [['application_id', 'programme', 'status', 'created', 'decision_amount_ttd', 'account_last4'], ...s.applications.map((a) => [a.id, a.programmeId, a.status, iso(a.createdAt), a.decision?.amountTTD ?? '', `****${a.accountRefLast4}`])])}>
          <Download className="size-4" /> Rebate applications CSV (masked)
        </button>
      )}
    </div>
  )
}

function CsvBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn-ghost btn-sm" onClick={onClick}>
      <Download className="size-4" /> CSV
    </button>
  )
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="card p-4">
      <div className="text-[13px] font-semibold text-navy-800">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums text-navy-900">{value}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  )
}
