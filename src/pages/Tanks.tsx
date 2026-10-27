import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Droplets, Plus } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe, useNow, useVisibleTanks } from '../store/hooks'
import { can } from '../domain/rbac'
import { availableL, fmtL, percentFull, tankStatus, timeAgo } from '../domain/calc'
import { Empty, Field, LiveTag, Modal, PageHeader, SimTag, StatusBadge, Tag } from '../components/ui'
import { TankGraphic } from '../components/TankGraphic'
import { useAct } from '../components/Toasts'

export default function Tanks() {
  const me = useMe()
  const now = useNow(3000)
  const tanks = useVisibleTanks()
  const devices = useStore((s) => s.devices)
  const buildings = useStore((s) => s.buildings)
  const valves = useStore((s) => s.valves)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const staff = can(me, 'tank:view-all')
  const list = tanks.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()) || buildings.find((b) => b.id === t.buildingId)?.name.toLowerCase().includes(q.toLowerCase()))
  const mine = list.filter((t) => t.ownerId === me.id)
  const others = list.filter((t) => t.ownerId !== me.id)

  const card = (t: (typeof tanks)[number]) => {
    const dev = devices.find((d) => d.id === t.levelDeviceId)
    const st = tankStatus(t, dev, now)
    const off = st === 'offline'
    const v = valves.find((x) => x.id === t.valveId)
    const b = buildings.find((x) => x.id === t.buildingId)
    const pct = percentFull(t.volumeL, t.capacityL)
    return (
      <Link key={t.id} to={`/tanks/${t.id}`} className="card flex min-w-0 gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
        <TankGraphic pct={pct} highPct={t.highThresholdPct} minPct={v ? (v.config.minRetainedL / t.capacityL) * 100 : undefined} offline={off} releasing={v?.state === 'open'} label={t.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-bold text-navy-900">{t.name}</div>
              <div className="truncate text-xs text-muted">
                {t.id.toUpperCase()} · {b?.name}
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={st} />
            {dev?.source === 'live' ? <LiveTag /> : <SimTag />}
            {t.shared && <Tag tone="navy">Public demo</Tag>}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-muted">Stored</dt>
            <dd className="text-right font-semibold tabular-nums text-navy-900">{off ? '—' : fmtL(t.volumeL)}</dd>
            <dt className="text-muted">Capacity</dt>
            <dd className="text-right font-semibold tabular-nums text-navy-900">{fmtL(t.capacityL)}</dd>
            <dt className="text-muted">Available</dt>
            <dd className="text-right font-semibold tabular-nums text-navy-900">{off ? '—' : fmtL(availableL(t.volumeL, t.capacityL))}</dd>
            <dt className="text-muted">Updated</dt>
            <dd className={`text-right font-semibold ${off ? 'text-danger-700' : 'text-navy-900'}`}>{timeAgo(t.lastReadingAt, now)}</dd>
          </dl>
          {v && <div className="mt-2 text-xs text-muted">Valve: <b className="text-navy-900">{v.state}</b> · {v.mode} mode</div>}
        </div>
      </Link>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Feature 1"
        title={staff ? 'All tanks' : 'My tanks'}
        actions={
          can(me, 'tank:add') && (
            <button className="btn-teal" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add tank
            </button>
          )
        }
      >
        Live level, capacity and history for each rainwater tank. Percentages and available space are calculated from the measured volume.
      </PageHeader>
      <input className="input mb-4 max-w-sm" placeholder="Search tanks or buildings…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tanks" />
      {list.length === 0 ? (
        <Empty icon={<Droplets className="size-6" />} title="No tanks found">
          {q ? 'Try a different search.' : 'Add your first rainwater tank to start monitoring.'}
        </Empty>
      ) : (
        <>
          {mine.length > 0 && (
            <>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">Owned by you</h2>
              <div className="mb-6 grid gap-3 md:grid-cols-2">{mine.map(card)}</div>
            </>
          )}
          {others.length > 0 && (
            <>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">{staff ? 'Other registered tanks' : 'Shared demonstration tanks'}</h2>
              <div className="grid gap-3 md:grid-cols-2">{others.map(card)}</div>
            </>
          )}
        </>
      )}
      <AddTank open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function AddTank({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe()
  const buildings = useStore((s) => s.buildings).filter((b) => me.role === 'admin' || b.ownerId === me.id)
  const addTank = useStore((s) => s.addTank)
  const act = useAct()
  const [f, setF] = useState({ name: '', buildingId: '', gallons: '', capacityL: '', volumeL: '0', catchmentM2: '60' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (act(addTank({ name: f.name, buildingId: f.buildingId || buildings[0]?.id, capacityL: Number(f.capacityL), volumeL: Number(f.volumeL), catchmentM2: Number(f.catchmentM2) }))) onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Add a tank">
      {buildings.length === 0 ? (
        <p className="text-sm text-muted">You don’t have a registered property yet. In a full deployment you would register your property first.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Field label="Tank name" htmlFor="tn">
            <input id="tn" className="input" required value={f.name} onChange={set('name')} placeholder="e.g. Back-yard tank" />
          </Field>
          <Field label="Property" htmlFor="tb">
            <select id="tb" className="input" value={f.buildingId} onChange={set('buildingId')}>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacity (L)" htmlFor="tc" hint="1 US gal ≈ 3.785 L">
              <input id="tc" className="input" type="number" min={1} required value={f.capacityL} onChange={set('capacityL')} />
            </Field>
            <Field label="…or gallons" htmlFor="tg">
              <input id="tg" className="input" type="number" min={0} value={f.gallons} onChange={(e) => setF({ ...f, gallons: e.target.value, capacityL: e.target.value ? String(Math.round(Number(e.target.value) * 3.785)) : f.capacityL })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current volume (L)" htmlFor="tv">
              <input id="tv" className="input" type="number" min={0} value={f.volumeL} onChange={set('volumeL')} />
            </Field>
            <Field label="Roof catchment (m²)" htmlFor="tr" hint="Roof area draining to tank">
              <input id="tr" className="input" type="number" min={1} value={f.catchmentM2} onChange={set('catchmentM2')} />
            </Field>
          </div>
          <p className="rounded-xl bg-amber-100 p-3 text-xs text-amber-700">A simulated level sensor will be attached. Replace it with a real device from Settings → Devices.</p>
          <button className="btn-primary w-full" type="submit">
            Add tank
          </button>
        </form>
      )}
    </Modal>
  )
}
