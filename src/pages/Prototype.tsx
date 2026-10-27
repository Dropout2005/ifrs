import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Cloud, Cpu, Globe, Radio, ShieldCheck, Wifi, Send } from 'lucide-react'
import { useStore } from '../store/store'
import { useDrainView, useMe, useNow, useTankView } from '../store/hooks'
import { can } from '../domain/rbac'
import { fmtL, timeAgo } from '../domain/calc'
import { Field, KV, LiveTag, PageHeader, Section, Segmented, SimTag, StatusBadge, Tag } from '../components/ui'
import { TankGraphic } from '../components/TankGraphic'
import { LevelChart } from '../components/Charts'
import { useAct } from '../components/Toasts'
import type { Drain, Tank } from '../domain/types'

const SAMPLE = `{
  "device_id": "dev-t-tatil-lvl",
  "distance_cm": 38.5,
  "tank_height_cm": 120,
  "battery_v": 4.1,
  "seq": 1
}`

export default function Prototype() {
  const me = useMe()
  const now = useNow(3000)
  const s = useStore()
  const act = useAct()
  const tank = s.tanks.find((t) => t.id === 't-tatil') as Tank
  const drain = s.drains.find((d) => d.id === 'd-tat') as Drain
  const tv = useTankView(tank)!
  const dv = useDrainView(drain)!
  const valve = s.valves.find((v) => v.id === tank.valveId)
  const [payload, setPayload] = useState(SAMPLE)
  const [url, setUrl] = useState(s.sim.liveUrl)
  const [result, setResult] = useState<string[]>([])

  const sendTest = () => {
    try {
      const j = JSON.parse(payload)
      const r = s.ingestLive(Array.isArray(j) ? j : [j])
      setResult(r)
      // bump seq so repeated sends are accepted
      if (!Array.isArray(j) && typeof j.seq === 'number') setPayload(JSON.stringify({ ...j, seq: j.seq + 1 }, null, 2))
    } catch (e) {
      setResult([`Invalid JSON: ${(e as Error).message}`])
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Field demonstration" title="Tatil prototype station" actions={tv.live ? <LiveTag /> : <SimTag />}>
        Our test rig at the Tatil Building on Maraval Road, Port of Spain: a rainwater tank with an ultrasonic level sensor, a slow-release valve and a drain-level sensor, built around an Arduino-compatible board.
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="card overflow-hidden">
          <div className="bg-navy-900 p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="display text-xl">Demonstration tank</span>
              <StatusBadge status={tv.status} />
            </div>
          </div>
          <div className="flex items-center gap-5 p-5">
            <TankGraphic pct={tv.pct} highPct={tank.highThresholdPct} minPct={valve ? (valve.config.minRetainedL / tank.capacityL) * 100 : undefined} releasing={valve?.state === 'open'} offline={tv.unavailable} size="lg" label="Tatil demonstration tank" />
            <dl className="flex-1">
              <KV k="Level" v={tv.unavailable ? 'Unavailable' : `${Math.round(tv.pct)}%`} />
              <KV k="Volume" v={fmtL(tank.volumeL)} />
              <KV k="Valve" v={valve ? `${valve.state} (${valve.mode})` : '—'} />
              <KV k="Updated" v={timeAgo(tank.lastReadingAt, now)} />
              <KV k="Data" v={tv.live ? 'Live from Arduino' : 'Simulated'} />
            </dl>
          </div>
          <div className="border-t border-sand-100 px-5 py-3 text-sm">
            <Link to={`/tanks/${tank.id}`} className="inline-flex items-center gap-1 font-semibold text-teal-700">
              Valve logic & full history <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
        <Section title="Maraval Rd drain sensor" action={<StatusBadge status={dv.status} />}>
          <LevelChart data={drain.history.slice(-60)} unit="cm" max={drain.rangeCm} height={180} color="#1d4275" label="Drain level near the Tatil Building" refs={[{ y: drain.elevatedCm, label: 'Elevated', color: '#8a4b00' }]} />
          <div className="mt-2 text-sm text-muted">
            Now: <b className="text-navy-900">{dv.unavailable ? 'unavailable' : `${drain.levelCm.toFixed(0)} cm`}</b> · {dv.live ? 'live' : 'simulated'} · <Link to={`/drains/${drain.id}`} className="text-teal-700 underline">details</Link>
          </div>
        </Section>
      </div>

      <Section title="How the Arduino will connect" className="mt-5">
        <ol className="grid gap-3 md:grid-cols-4">
          {[
            { Icon: Radio, t: '1 · Measure', d: 'Ultrasonic sensor above the water measures the distance to the surface every few seconds.' },
            { Icon: Cpu, t: '2 · Package', d: 'The board turns it into a small JSON message (device ID, distance, tank height, sequence number).' },
            { Icon: Wifi, t: '3 · Send', d: 'Over Wi-Fi (or via a laptop/phone bridge for boards without Wi-Fi) to a small cloud data endpoint.' },
            { Icon: Globe, t: '4 · Display', d: 'This site reads the latest message, validates it, and updates the tank, alerts and valve logic.' },
          ].map(({ Icon, t, d }) => (
            <li key={t} className="rounded-2xl bg-sand-50 p-4">
              <Icon className="size-6 text-teal-700" aria-hidden />
              <div className="mt-2 font-bold text-navy-900">{t}</div>
              <div className="text-sm text-muted">{d}</div>
            </li>
          ))}
        </ol>
        <p className="mt-3 flex gap-2 rounded-xl bg-navy-50 p-3 text-sm text-navy-800">
          <ShieldCheck className="size-5 shrink-0" />
          <span>
            The website only <b>reads</b> sensor data. The valve on the prototype is controlled by the board itself, which enforces its own limits (minimum water kept, close on lost signal). The web app never sends commands to real hardware.
          </span>
        </p>
      </Section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Section title="Try a sensor message" action={<Tag tone="amber">No hardware needed</Tag>}>
          <p className="mb-2 text-sm text-muted">This is exactly what the Arduino will send. Edit the numbers and press send – the tank above updates as if the board had reported it.</p>
          <textarea className="input min-h-44 font-mono text-xs" value={payload} onChange={(e) => setPayload(e.target.value)} aria-label="JSON payload" spellCheck={false} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-primary btn-sm" onClick={sendTest}>
              <Send className="size-4" /> Send test reading
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setPayload(JSON.stringify({ device_id: 'dev-t-tatil-lvl', level_pct: 96, seq: Date.now() }, null, 2))}>
              Nearly full
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setPayload(JSON.stringify({ device_id: 'dev-d-tat', drain_level_cm: 78, seq: Date.now() }, null, 2))}>
              High drain
            </button>
            {tv.live && (
              <button className="btn-ghost btn-sm" onClick={() => { s.setSim({ dataSource: 'simulated' }); setResult(['Back to simulated data']) }}>
                Back to simulation
              </button>
            )}
          </div>
          {result.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs" aria-live="polite">
              {result.map((r, i) => (
                <li key={i} className={`rounded-lg px-3 py-1.5 ${r.startsWith('Accepted') || r.startsWith('Back') ? 'bg-leaf-100 text-leaf-600' : 'bg-danger-100 text-danger-700'}`}>
                  {r}
                </li>
              ))}
            </ul>
          )}
          <p className="hint">Accepted fields: device_id, ts, level_pct | volume_l | distance_cm + tank_height_cm, drain_level_cm, leak, battery_v, seq.</p>
        </Section>

        <Section title="Live data source">
          <Segmented label="Data source" value={s.sim.dataSource} onChange={(v) => s.setSim({ dataSource: v })} options={[{ value: 'simulated', label: 'Simulated' }, { value: 'live', label: 'Live feed (URL)' }]} />
          <div className="mt-3 space-y-3">
            <Field label="Feed URL (HTTPS, returns the JSON above)" htmlFor="lu" hint="Set once the Arduino is publishing – e.g. a cloud key-value store, Supabase REST or a small Apps Script.">
              <div className="flex gap-2">
                <input id="lu" className="input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!can(me, 'sim:control')} />
                <button className="btn-ghost" onClick={() => { if (url && !/^https:\/\//.test(url)) return act({ ok: false, message: 'URL must start with https://' }); s.setSim({ liveUrl: url }); act({ ok: true, message: 'Feed URL saved' }) }}>
                  Save
                </button>
              </div>
            </Field>
            <dl className="rounded-xl bg-sand-50 p-3">
              <KV k="Mode" v={s.sim.dataSource} />
              <KV k="Poll every" v={`${s.sim.livePollSec} s`} />
              <KV k="Mapped device" v={s.sim.liveDeviceId} />
              <KV k="Last result" v={<span className="text-xs">{s.sim.liveLastStatus ?? '—'}</span>} />
            </dl>
            <p className="flex gap-2 text-xs text-muted">
              <Cloud className="size-4 shrink-0" />
              <span>If the feed stops, the tank turns “stale” and then “offline” – the old reading is never shown as current, and automatic release stops.</span>
            </p>
          </div>
        </Section>
      </div>
    </div>
  )
}
