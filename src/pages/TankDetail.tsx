import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CircleCheck, CircleX, Lock, OctagonX, Power, PowerOff, Siren, Wrench, ShieldAlert, FlaskConical, Info } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe, useNameOf, useNow, useTankView } from '../store/hooks'
import { can, canConfigureValve, canManualOperate, canViewTank } from '../domain/rbac'
import { availableL, fmtDateTime, fmtL, fmtPct, timeAgo } from '../domain/calc'
import { isLeakOpen, LEAK_LABEL } from '../domain/leak'
import { Empty, Field, KV, LiveTag, MeasuredTag, PageHeader, Section, Segmented, SimTag, StatusBadge, Tag, Toggle } from '../components/ui'
import { TankGraphic } from '../components/TankGraphic'
import { LevelChart } from '../components/Charts'
import { useAct } from '../components/Toasts'
import type { Tank, Valve, ValveConfig } from '../domain/types'

export default function TankDetail() {
  const { id } = useParams()
  const me = useMe()
  const now = useNow(3000)
  const tank = useStore((s) => s.tanks.find((t) => t.id === id)) as Tank | undefined
  const view = useTankView(tank)
  const building = useStore((s) => s.buildings.find((b) => b.id === tank?.buildingId))
  const leaks = useStore((s) => s.leaks).filter((l) => l.tankId === id)
  const [range, setRange] = useState<'6h' | '24h' | '48h' | 'all'>('24h')

  if (!tank || !view) return <Empty icon={<Info className="size-6" />} title="Tank not found" />
  if (!canViewTank(me, tank))
    return (
      <Empty icon={<Lock className="size-6" />} title="Private tank">
        This tank belongs to another resident. Household tank data is only visible to its owner and authorised staff.
      </Empty>
    )

  const { pct, status, device, valve, unavailable, live } = view
  const cutoff = range === 'all' ? 0 : now - { '6h': 6, '24h': 24, '48h': 48 }[range] * 3_600_000
  const hist = tank.history.filter((r) => r.t >= cutoff)
  const minPct = valve ? (valve.config.minRetainedL / tank.capacityL) * 100 : undefined

  return (
    <div>
      <Link to="/tanks" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-teal-700">
        <ArrowLeft className="size-4" /> Tanks
      </Link>
      <PageHeader eyebrow={`${tank.id.toUpperCase()} · ${building?.name ?? ''}`} title={tank.name} actions={<div className="flex flex-wrap gap-1.5"><StatusBadge status={status} size="md" />{live ? <LiveTag /> : <SimTag />}</div>} />

      {unavailable && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-sand-100 p-4 text-sm text-ink" role="alert">
          <PowerOff className="mt-0.5 size-5 shrink-0 text-muted" />
          <div>
            <b>Reading unavailable.</b> The level sensor has not reported since {fmtDateTime(tank.lastReadingAt)} ({timeAgo(tank.lastReadingAt, now)}). The last value is shown greyed out and is <b>not</b> current. Automatic release is disabled until fresh data arrives.
          </div>
        </div>
      )}
      {tank.quality !== 'ok' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-navy-50 p-4 text-sm" role="alert">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-navy-800" />
          <div>
            <b>Sensor inconsistency:</b> the last reading was {tank.quality === 'overflow' ? 'above the tank’s capacity (overflow or sensor fault)' : 'invalid'}. Displayed volume is clamped; please inspect.
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Section title="Current level">
          <div className={`flex items-center gap-5 ${unavailable ? 'opacity-50' : ''}`}>
            <TankGraphic pct={pct} highPct={tank.highThresholdPct} minPct={minPct} offline={unavailable} releasing={valve?.state === 'open'} size="lg" label={tank.name} />
            <dl className="min-w-0 flex-1">
              <KV k={<span className="flex items-center gap-1.5">Volume <MeasuredTag kind="measured" /></span>} v={fmtL(tank.volumeL)} />
              <KV k="Capacity" v={fmtL(tank.capacityL)} />
              <KV k={<span className="flex items-center gap-1.5">Full <MeasuredTag kind="calculated" /></span>} v={fmtPct(pct)} />
              <KV k={<span className="flex items-center gap-1.5">Available <MeasuredTag kind="calculated" /></span>} v={fmtL(availableL(tank.volumeL, tank.capacityL))} />
              <KV k="Last update" v={timeAgo(tank.lastReadingAt, now)} />
              <KV k="Sensor" v={<span className="capitalize">{view.health}{device?.battery !== undefined ? ` · ${device.battery}% batt.` : ''}</span>} />
              <KV k="Thresholds" v={`high ${tank.highThresholdPct}% · low ${tank.lowThresholdPct}%`} />
            </dl>
          </div>
          <p className="mt-3 text-[11px] text-muted">% full = volume ÷ capacity × 100 · available = capacity − volume</p>
        </Section>

        <Section title="Level history" action={<Segmented label="History range" value={range} onChange={setRange} options={[{ value: '6h', label: '6h' }, { value: '24h', label: '24h' }, { value: '48h', label: '48h' }, { value: 'all', label: 'All' }]} />}>
          <LevelChart
            data={hist}
            unit="L"
            max={tank.capacityL}
            label={`${tank.name} volume`}
            refs={[
              { y: (tank.highThresholdPct / 100) * tank.capacityL, label: `High ${tank.highThresholdPct}%`, color: '#a0111c' },
              ...(valve ? [{ y: valve.config.minRetainedL, label: 'Keep for reuse', color: '#0b2545' }] : []),
            ]}
          />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ['Collected', tank.collectedL],
              ['Used', tank.usedL],
              ['Released', tank.releasedL],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-sand-50 p-2">
                <div className="text-[11px] text-muted">{k} (estimate)</div>
                <div className="font-bold tabular-nums text-navy-900">{fmtL(Number(v))}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">Collection is estimated from roof area ({tank.catchmentM2} m²) × rainfall × 0.85 runoff; usage and release from valve and flow logs. Estimates are not meter readings.</p>
        </Section>
      </div>

      {valve && <ValvePanel tank={tank} valve={valve as Valve} />}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {can(me, 'sim:control') && <SimPanel tank={tank} />}
        <Section title="Leak alerts for this tank" action={<Link to="/leaks" className="text-[13px] font-semibold text-teal-700">Leak centre →</Link>}>
          {leaks.length === 0 ? (
            <p className="text-sm text-muted">No leak alerts recorded.</p>
          ) : (
            <ul className="space-y-2">
              {leaks.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-xl bg-sand-50 p-3">
                  <Siren className={`size-5 ${isLeakOpen(l.status) ? 'text-amber-500' : 'text-muted'}`} aria-hidden />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-navy-900">{LEAK_LABEL[l.status]}</div>
                    <div className="text-xs text-muted">{fmtDateTime(l.detectedAt)} · {l.method.replace('-', ' ')}</div>
                  </div>
                  <Tag tone={l.severity === 'high' ? 'red' : l.severity === 'medium' ? 'amber' : 'gray'}>{l.severity}</Tag>
                </li>
              ))}
            </ul>
          )}
          {canConfigureValve(me, tank) && <ThresholdForm tank={tank} />}
        </Section>
      </div>
    </div>
  )
}

function ThresholdForm({ tank }: { tank: Tank }) {
  const update = useStore((s) => s.updateTank)
  const act = useAct()
  const [hi, setHi] = useState(String(tank.highThresholdPct))
  const [lo, setLo] = useState(String(tank.lowThresholdPct))
  return (
    <form
      className="mt-4 grid grid-cols-[1fr_1fr_auto] items-end gap-2 border-t border-sand-100 pt-4"
      onSubmit={(e) => {
        e.preventDefault()
        act(update(tank.id, { highThresholdPct: Number(hi), lowThresholdPct: Number(lo) }))
      }}
    >
      <Field label="High alert (%)" htmlFor="hi">
        <input id="hi" className="input" type="number" value={hi} onChange={(e) => setHi(e.target.value)} />
      </Field>
      <Field label="Low alert (%)" htmlFor="lo">
        <input id="lo" className="input" type="number" value={lo} onChange={(e) => setLo(e.target.value)} />
      </Field>
      <button className="btn-ghost">Save</button>
    </form>
  )
}

function ValvePanel({ tank, valve }: { tank: Tank; valve: Valve }) {
  const me = useMe()
  const nameOf = useNameOf()
  const s = useStore()
  const act = useAct()
  const drain = s.drains.find((d) => d.id === valve.drainId)
  const canCfg = canConfigureValve(me, tank)
  const canOp = canManualOperate(me, tank, valve)
  const d = valve.lastDecision
  const stateTone = valve.state === 'fault' ? 'red' : valve.state === 'open' || valve.state === 'opening' ? 'teal' : 'gray'
  return (
    <section className="card mt-5 overflow-hidden">
      <div className="flex flex-col gap-3 bg-navy-900 p-4 text-white sm:flex-row sm:items-center sm:p-5">
        <div className="flex-1">
          <div className="eyebrow text-teal-400">Feature 2 · Automated slow release (simulated controller)</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="display text-2xl">Valve {valve.state}</span>
            <Tag tone={stateTone as never}>{valve.mode} mode</Tag>
            {valve.currentReleaseLpm > 0 && <Tag tone="teal">{valve.currentReleaseLpm.toFixed(0)} L/min</Tag>}
          </div>
          <p className="mt-1 text-sm text-white/80" aria-live="polite">
            {d?.summary ?? 'Awaiting first evaluation'}
          </p>
        </div>
        {canOp && (
          <div className="flex flex-wrap gap-2">
            <button className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20" onClick={() => act(s.setValveMode(valve.id, valve.mode === 'auto' ? 'manual' : 'auto'))}>
              Switch to {valve.mode === 'auto' ? 'manual' : 'auto'}
            </button>
            {valve.mode === 'manual' && (
              <>
                <button className="btn bg-teal-400 text-navy-950 hover:bg-teal-500" onClick={() => act(s.manualValve(valve.id, 'open'))}>
                  <Power className="size-4" /> Open
                </button>
                <button className="btn bg-white text-navy-900" onClick={() => act(s.manualValve(valve.id, 'close'))}>
                  <PowerOff className="size-4" /> Close
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h3 className="mb-2 text-sm font-bold text-navy-900">Why the valve is {valve.state}</h3>
          <ul className="space-y-1.5">
            {d?.rules.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-sm">
                {r.pass ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-leaf-600" aria-label="Passed" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-danger-500" aria-label="Not met" />}
                <div>
                  <span className="font-semibold text-navy-900">{r.label}</span>
                  <span className="text-muted"> — {r.detail}</span>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-4 rounded-xl bg-sand-50 p-3">
            <KV k="Downstream drain" v={drain ? <Link className="text-teal-700 underline" to={`/drains/${drain.id}`}>{drain.name}</Link> : 'None'} />
            <KV k="Minimum retained" v={fmtL(valve.config.minRetainedL)} />
            <KV k="High-level trigger" v={fmtL(valve.config.highTriggerL)} />
            <KV k="Max release rate" v={`${valve.config.maxReleaseLpm} L/min`} />
            <KV k="Operating window" v={valve.config.windowStart === valve.config.windowEnd ? '24 hours' : `${valve.config.windowStart}–${valve.config.windowEnd}`} />
            <KV k="Safety interlocks" v={d?.rules.slice(0, 7).every((r) => r.pass) ? 'Clear' : 'Holding'} />
            <KV k="Last operation" v={`${timeAgo(valve.lastOperationAt)} · ${nameOf(valve.lastOperationBy)}`} />
          </dl>
          <p className="mt-3 flex gap-2 rounded-xl bg-amber-100 p-3 text-xs text-amber-700">
            <ShieldAlert className="size-4 shrink-0" />
            Demonstration policy only. A real installation needs a local controller that enforces these limits on its own, fails safe on loss of communication, and is validated by qualified engineers and the relevant authorities. Releasing water does not by itself prevent flooding.
          </p>
        </div>
        <div>
          {canCfg ? <ValveConfigForm valve={valve} tank={tank} /> : <p className="rounded-xl bg-sand-50 p-3 text-sm text-muted"><Lock className="mr-1 inline size-4" />Only the owner or an administrator can change release settings.</p>}
          <h3 className="mb-2 mt-5 text-sm font-bold text-navy-900">Release history</h3>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {valve.log.slice(0, 25).map((l) => (
              <li key={l.id} className="rounded-lg bg-sand-50 px-3 py-2 text-xs">
                <div className="flex justify-between gap-2">
                  <b className="uppercase text-navy-900">{l.action}</b>
                  <span className="text-muted">{fmtDateTime(l.t)}</span>
                </div>
                <div className="text-muted">
                  {l.mode} · {nameOf(l.by)} — {l.reason}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function ValveConfigForm({ valve, tank }: { valve: Valve; tank: Tank }) {
  const me = useMe()
  const save = useStore((s) => s.updateValveConfig)
  const act = useAct()
  const [c, setC] = useState<ValveConfig>(valve.config)
  const num = (k: keyof ValveConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value) })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const { manualOverrideRoles, ...rest } = c
        act(save(valve.id, me.role === 'admin' ? c : rest))
      }}
      className="space-y-3"
    >
      <h3 className="text-sm font-bold text-navy-900">Release settings</h3>
      <Field label={`Keep for reuse: ${fmtL(c.minRetainedL)} (${Math.round((c.minRetainedL / tank.capacityL) * 100)}%)`} htmlFor="min" hint="Water always kept for flushing and other non-potable use">
        <input id="min" type="range" min={0} max={tank.capacityL} step={50} value={c.minRetainedL} onChange={num('minRetainedL')} className="w-full accent-teal-600" />
      </Field>
      <Field label={`Start releasing at: ${fmtL(c.highTriggerL)} (${Math.round((c.highTriggerL / tank.capacityL) * 100)}%)`} htmlFor="trig">
        <input id="trig" type="range" min={0} max={tank.capacityL} step={50} value={c.highTriggerL} onChange={num('highTriggerL')} className="w-full accent-teal-600" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Max rate (L/min)" htmlFor="rate">
          <input id="rate" className="input" type="number" value={c.maxReleaseLpm} onChange={num('maxReleaseLpm')} />
        </Field>
        <Field label="Suspend if drain ≥ (cm)" htmlFor="ds">
          <input id="ds" className="input" type="number" value={c.drainSuspendCm} onChange={num('drainSuspendCm')} />
        </Field>
        <Field label="Window start" htmlFor="ws">
          <input id="ws" className="input" type="time" value={c.windowStart} onChange={(e) => setC({ ...c, windowStart: e.target.value })} />
        </Field>
        <Field label="Window end" htmlFor="we">
          <input id="we" className="input" type="time" value={c.windowEnd} onChange={(e) => setC({ ...c, windowEnd: e.target.value })} />
        </Field>
      </div>
      <Toggle label="Automatic release enabled" checked={c.autoEnabled} onChange={(v) => setC({ ...c, autoEnabled: v })} id="auto" />
      {me.role === 'admin' && (
        <Toggle label="Resident owner may use manual override" checked={c.manualOverrideRoles.includes('resident')} onChange={(v) => setC({ ...c, manualOverrideRoles: v ? ['admin', 'maintenance', 'resident'] : ['admin', 'maintenance'] })} id="mor" />
      )}
      <button className="btn-primary w-full">Save & re-evaluate</button>
    </form>
  )
}

function SimPanel({ tank }: { tank: Tank }) {
  const s = useStore()
  const act = useAct()
  const view = useTankView(tank)!
  const [lvl, setLvl] = useState(Math.round(tank.volumeL))
  const valve = s.valves.find((v) => v.id === tank.valveId)
  const probe = s.devices.find((d) => d.id === tank.leakDeviceId)
  const dev = view.device
  const isLive = dev?.source === 'live'
  return (
    <section className="card border-2 border-dashed border-amber-500/50 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="size-5 text-amber-700" />
        <h2 className="flex-1 text-[15px] font-bold text-navy-900">Simulation controls</h2>
        <Tag tone="amber">Demo only</Tag>
      </div>
      {isLive ? (
        <p className="text-sm text-muted">This tank is receiving live sensor data, so its level can’t be simulated. Switch the data source back to “simulated” on the Prototype page.</p>
      ) : (
        <>
          <Field label={`Set tank level: ${fmtL(lvl)} (${Math.round((lvl / tank.capacityL) * 100)}%)`} htmlFor="simlvl" hint="Drag, then apply. The graphic, alerts and valve logic respond immediately.">
            <input id="simlvl" type="range" min={0} max={tank.capacityL} step={10} value={lvl} onChange={(e) => setLvl(Number(e.target.value))} className="w-full accent-amber-500" />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-primary btn-sm" onClick={() => act(s.setTankVolume(tank.id, lvl))}>
              Apply level
            </button>
            {[10, 50, 95].map((p) => (
              <button key={p} className="btn-ghost btn-sm" onClick={() => { const v = (p / 100) * tank.capacityL; setLvl(v); act(s.setTankVolume(tank.id, v)) }}>
                {p}%
              </button>
            ))}
            <button className="btn-ghost btn-sm" onClick={() => act(s.setTankVolume(tank.id, tank.capacityL * 1.2))} title="Send an impossible reading above capacity">
              Bad reading (120%)
            </button>
            <button className="btn-ghost btn-sm" onClick={() => act(s.setTankVolume(tank.id, -50))}>
              Negative reading
            </button>
          </div>
        </>
      )}
      <div className="mt-4 space-y-1 border-t border-sand-100 pt-3">
        {dev && <Toggle id="disc" label="Disconnect level sensor" checked={!!dev.simDisconnected} onChange={(v) => s.setDeviceDisconnected(dev.id, v)} />}
        <Toggle id="leak" label="Hidden slow leak (detector must infer it)" checked={tank.simLeakLpm > 0} onChange={(v) => s.setSimLeak(tank.id, v ? Math.max(2, tank.capacityL * 0.0012) : 0)} />
        {probe && <Toggle id="probe" label="Leak probe detects water" checked={!!probe.wet} onChange={(v) => s.setLeakProbe(tank.id, v)} />}
        {valve && <Toggle id="vfault" label="Valve controller fault" checked={valve.simFault} onChange={(v) => s.setValveFault(valve.id, v)} />}
      </div>
      {tank.simLeakLpm > 0 && <p className="mt-2 text-xs text-muted">Leak suspicion counter: {tank.leakSuspicionCount}/4 consecutive unexplained drops (stop rain on the Demo page to see it faster).</p>}
      {s.sim.emergencyStop && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-danger-700">
          <OctagonX className="size-4" /> Emergency stop is active
        </p>
      )}
      <Link to="/demo" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-teal-700">
        <Wrench className="size-4" /> Weather & scenario controls
      </Link>
    </section>
  )
}
