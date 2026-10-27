import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Info, TriangleAlert, FlaskConical } from 'lucide-react'
import { useStore } from '../store/store'
import { useDrainView, useMe, useNameOf, useNow } from '../store/hooks'
import { can } from '../domain/rbac'
import { accelFor, basketOverdue, blockageSignals, fmtDate, fmtDateTime, rateOfRise, timeAgo } from '../domain/calc'
import { Empty, Field, KV, LiveTag, PageHeader, Section, Segmented, SimTag, StatusBadge, Tag } from '../components/ui'
import { LevelChart } from '../components/Charts'
import { AssetMap } from '../components/AssetMap'
import { useAct } from '../components/Toasts'
import type { Drain } from '../domain/types'

export default function DrainDetail() {
  const { id } = useParams()
  const me = useMe()
  const now = useNow(3000)
  const nameOf = useNameOf()
  const drain = useStore((s) => s.drains.find((d) => d.id === id)) as Drain | undefined
  const view = useDrainView(drain)
  const rain = useStore((s) => s.sim.rain)
  const tasks = useStore((s) => s.tasks).filter((t) => t.assetId === id)
  const valves = useStore((s) => s.valves).filter((v) => v.drainId === id)
  const tanks = useStore((s) => s.tanks)
  const [range, setRange] = useState<'6h' | '24h' | '48h'>('24h')
  if (!drain || !view) return <Empty icon={<Info className="size-6" />} title="Drain not found" />
  const rise = rateOfRise(drain.history, 15, accelFor(view.device))
  const signals = view.unavailable ? [] : blockageSignals(drain, rain, now, accelFor(view.device))
  const cutoff = now - { '6h': 6, '24h': 24, '48h': 48 }[range] * 3_600_000

  return (
    <div>
      <Link to="/drains" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-teal-700">
        <ArrowLeft className="size-4" /> Drains
      </Link>
      <PageHeader eyebrow={drain.id.toUpperCase()} title={drain.name} actions={<div className="flex gap-1.5"><StatusBadge status={view.status} size="md" />{view.live ? <LiveTag /> : <SimTag />}</div>} />
      {view.unavailable && (
        <div className="mb-4 rounded-2xl bg-sand-100 p-4 text-sm" role="alert">
          <b>Reading unavailable.</b> No data since {fmtDateTime(drain.lastReadingAt)}. The last known level ({drain.levelCm.toFixed(0)} cm) is outdated and is not used for release decisions.
        </div>
      )}
      {signals.length > 0 && (
        <div className="mb-4 flex gap-3 rounded-2xl bg-danger-100 p-4 text-sm text-danger-700" role="alert">
          <TriangleAlert className="size-5 shrink-0" />
          <div>
            <b>{drain.blockageConfirmed ? 'Blockage confirmed by inspection.' : 'Suspected blockage (not yet confirmed):'}</b>
            <ul className="mt-1 list-disc pl-4">
              {signals.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Section title="Water level" action={<Segmented label="Range" value={range} onChange={setRange} options={[{ value: '6h', label: '6h' }, { value: '24h', label: '24h' }, { value: '48h', label: '48h' }]} />}>
          <LevelChart
            data={drain.history.filter((r) => r.t >= cutoff)}
            unit="cm"
            max={drain.rangeCm}
            color={view.status === 'critical' ? '#d62839' : '#1d4275'}
            label={`${drain.name} water level`}
            refs={[
              { y: drain.elevatedCm, label: 'Elevated', color: '#8a4b00' },
              { y: drain.criticalCm, label: 'Critical', color: '#a0111c' },
            ]}
          />
        </Section>
        <Section title="Details">
          <dl>
            <KV k="Current level" v={view.unavailable ? 'Unavailable' : `${drain.levelCm.toFixed(1)} cm (${Math.round((drain.levelCm / drain.rangeCm) * 100)}% of range)`} />
            <KV k="Rate of rise" v={rise === null ? '—' : `${rise.toFixed(2)} cm/min`} />
            <KV k="Thresholds" v={`safe < ${drain.elevatedCm} · critical ≥ ${drain.criticalCm} cm`} />
            <KV k="Fast-rise alert" v={`> ${drain.maxRiseCmPerMin} cm/min`} />
            <KV k="Last update" v={timeAgo(drain.lastReadingAt, now)} />
            <KV k="Device" v={<span className="capitalize">{view.health}</span>} />
            <KV k="Basket last cleaned" v={<span className={basketOverdue(drain, now) ? 'text-amber-700' : ''}>{fmtDate(drain.basketLastCleaned)}{basketOverdue(drain, now) ? ' (overdue)' : ''}</span>} />
          </dl>
          {valves.length > 0 && (
            <div className="mt-3 rounded-xl bg-sand-50 p-3 text-xs text-muted">
              Upstream tanks releasing here:{' '}
              {valves.map((v) => {
                const t = tanks.find((x) => x.id === v.tankId)
                return (
                  <Tag key={v.id} tone={v.state === 'open' ? 'teal' : 'gray'}>
                    {t?.name}: {v.state}
                  </Tag>
                )
              })}
              <div className="mt-1">Releases are suspended automatically when this drain is at or above each tank’s configured limit.</div>
            </div>
          )}
        </Section>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Section title="Inspection & cleaning history">
          {can(me, 'drain:inspect') && <InspectionForm drain={drain} />}
          <ul className="mt-3 space-y-2">
            {drain.inspections.map((i, k) => (
              <li key={k} className="rounded-xl bg-sand-50 p-3 text-sm">
                <div className="flex justify-between">
                  <b className="capitalize text-navy-900">{i.kind.replace('-', ' ')}</b>
                  <span className="text-xs text-muted">{fmtDate(i.t)}</span>
                </div>
                <div className="text-muted">
                  {i.note} · {nameOf(i.by)}
                </div>
              </li>
            ))}
          </ul>
          {tasks.length > 0 && (
            <div className="mt-3 text-sm">
              <b>Maintenance tasks:</b>{' '}
              {tasks.map((t) => (
                <Link key={t.id} to="/maintenance" className="mr-2 text-teal-700 underline">
                  {t.title} ({t.status.replace('_', ' ')})
                </Link>
              ))}
            </div>
          )}
        </Section>
        <div className="space-y-5">
          <Section title="Location">
            <AssetMap points={[{ id: drain.id, type: 'drain', lat: drain.lat, lng: drain.lng, title: drain.name, status: view.status, detail: `${drain.levelCm.toFixed(0)} cm` }]} center={[drain.lat, drain.lng]} zoom={16} height={220} />
          </Section>
          {can(me, 'sim:control') && <DrainSim drain={drain} />}
          {can(me, 'admin:thresholds') && <DrainThresholds drain={drain} />}
        </div>
      </div>
    </div>
  )
}

function InspectionForm({ drain }: { drain: Drain }) {
  const rec = useStore((s) => s.recordInspection)
  const act = useAct()
  const [kind, setKind] = useState<'inspection' | 'basket-clean' | 'repair'>('basket-clean')
  const [note, setNote] = useState('')
  const [blk, setBlk] = useState<'none' | 'confirmed' | 'cleared'>('none')
  return (
    <form
      className="space-y-2 rounded-xl border border-navy-100 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (act(rec(drain.id, kind, note, blk))) setNote('')
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as never)} aria-label="Record type">
          <option value="basket-clean">Basket cleaned</option>
          <option value="inspection">Inspection</option>
          <option value="repair">Repair</option>
        </select>
        <select className="input" value={blk} onChange={(e) => setBlk(e.target.value as never)} aria-label="Blockage finding">
          <option value="none">No blockage finding</option>
          <option value="confirmed">Blockage confirmed</option>
          <option value="cleared">Blockage cleared</option>
        </select>
      </div>
      <input className="input" placeholder="Notes (what was found / done)" value={note} onChange={(e) => setNote(e.target.value)} />
      <input className="input text-xs" type="file" accept="image/*" aria-label="Attach photo (demo – not uploaded)" />
      <button className="btn-primary btn-sm w-full">Record</button>
    </form>
  )
}

function DrainSim({ drain }: { drain: Drain }) {
  const s = useStore()
  const dev = s.devices.find((d) => d.id === drain.deviceId)
  return (
    <section className="card border-2 border-dashed border-amber-500/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-[15px] font-bold text-navy-900">
        <FlaskConical className="size-5 text-amber-700" /> Simulation controls
      </div>
      <Field label={`Simulated blockage: +${drain.simBlockageCm} cm`} htmlFor="blk" hint="Adds water that won’t drain away – the detector should flag a suspected blockage.">
        <input id="blk" type="range" min={0} max={90} value={drain.simBlockageCm} onChange={(e) => s.setDrainBlockage(drain.id, Number(e.target.value))} className="w-full accent-amber-500" />
      </Field>
      {dev && (
        <label className="mt-2 flex min-h-11 items-center justify-between text-sm">
          Disconnect sensor
          <input type="checkbox" className="size-5 accent-amber-500" checked={!!dev.simDisconnected} onChange={(e) => s.setDeviceDisconnected(dev.id, e.target.checked)} />
        </label>
      )}
    </section>
  )
}

function DrainThresholds({ drain }: { drain: Drain }) {
  const upd = useStore((s) => s.updateDrain)
  const act = useAct()
  const [el, setEl] = useState(String(drain.elevatedCm))
  const [cr, setCr] = useState(String(drain.criticalCm))
  const [ri, setRi] = useState(String(drain.maxRiseCmPerMin))
  return (
    <Section title="Thresholds (admin)">
      <form className="grid grid-cols-3 items-end gap-2" onSubmit={(e) => { e.preventDefault(); act(upd(drain.id, { elevatedCm: Number(el), criticalCm: Number(cr), maxRiseCmPerMin: Number(ri) })) }}>
        <Field label="Elevated cm" htmlFor="el"><input id="el" className="input" type="number" value={el} onChange={(e) => setEl(e.target.value)} /></Field>
        <Field label="Critical cm" htmlFor="cr"><input id="cr" className="input" type="number" value={cr} onChange={(e) => setCr(e.target.value)} /></Field>
        <Field label="Rise cm/min" htmlFor="ri"><input id="ri" className="input" type="number" step="0.1" value={ri} onChange={(e) => setRi(e.target.value)} /></Field>
        <button className="btn-ghost col-span-3">Save thresholds</button>
      </form>
    </Section>
  )
}
