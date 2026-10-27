import { Link } from 'react-router-dom'
import { CloudRain, OctagonX, Pause, Play, RotateCcw, FlaskConical, ChevronRight } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe } from '../store/hooks'
import { can } from '../domain/rbac'
import { RAIN_LABEL } from '../sim/engine'
import { PageHeader, Section, Segmented, Tag, Toggle } from '../components/ui'
import { useAct } from '../components/Toasts'
import type { RainLevel } from '../domain/types'

export default function Demo() {
  const me = useMe()
  const s = useStore()
  const act = useAct()
  const toast = s.toast
  const tank = (id: string) => s.tanks.find((t) => t.id === id)!

  const scenarios = [
    {
      t: 'Tank approaching capacity',
      d: 'South Quay Tank 2 jumps to 93%. Watch the high-level alert and the valve open automatically if the drain has room.',
      go: () => act(s.setTankVolume('t-sq2', tank('t-sq2').capacityL * 0.93)),
      to: '/tanks/t-sq2',
    },
    {
      t: 'Storm – drains rise, releases suspend',
      d: 'Severe rain fills tanks and drains together. Valves close themselves once a downstream drain passes its limit.',
      go: () => { s.setRain(3); toast('info', 'Severe storm started (simulated)') },
      to: '/drains',
    },
    {
      t: 'High downstream drain',
      d: 'Wrightson Rd Tank 1 is nearly full but its drain is elevated, so the valve stays closed. Open it to read why.',
      go: () => toast('info', 'Already in the seed data – open the tank to see the reasons'),
      to: '/tanks/t-wr1',
    },
    {
      t: 'Insufficient stored water',
      d: 'Tatil tank drops just above its “keep for reuse” level – release is refused even in manual mode.',
      go: () => { const v = s.valves.find((x) => x.tankId === 't-tatil')!; act(s.setTankVolume('t-tatil', v.config.minRetainedL + 50)) },
      to: '/tanks/t-tatil',
    },
    {
      t: 'Stale / disconnected sensor',
      d: 'The Tatil drain sensor stops reporting. Its reading is marked unavailable and the Tatil valve refuses to release.',
      go: () => { s.setDeviceDisconnected('dev-d-tat', true); toast('info', 'Drain sensor disconnected') },
      to: '/prototype',
    },
    {
      t: 'Valve fault',
      d: 'South Quay Tank 1’s valve controller reports a fault. Release is disabled and staff are notified.',
      go: () => { s.setValveFault('v-t-sq1', true); toast('info', 'Valve fault injected') },
      to: '/tanks/t-sq1',
    },
    {
      t: 'Leak',
      d: 'Aaliyah’s Home tank A leak probe gets wet – a suspected leak alert starts the inspection workflow.',
      go: () => { s.setLeakProbe('t-res1a', true); toast('info', 'Leak probe activated') },
      to: '/leaks',
    },
    {
      t: 'Blocked drain',
      d: 'Debris blocks South Quay @ Charlotte St. With little rain, IFRS flags a suspected blockage for inspection.',
      go: () => { s.setDrainBlockage('d-sq2', 55); s.setRain(0); toast('info', 'Blockage added and rain stopped') },
      to: '/drains/d-sq2',
    },
  ]

  const script = [
    ['Resident (Aaliyah)', 'Open My Tanks → Home tank A. Drag the simulation slider and watch the tank, %, alerts and valve respond.', '/tanks/t-res1a'],
    ['Resident', 'Community → New report: report a blocked drain with a map pin. Track it under “My reports”.', '/community'],
    ['Maintenance (Devon)', 'Switch persona. Community → Review queue: verify the report – the reporter gets 25 points exactly once.', '/community'],
    ['Maintenance', 'Leak Detection: acknowledge → inspect → confirm → repair the suspected leak.', '/leaks'],
    ['Maintenance', 'Community → Cleanup events: verify Kezia’s check-in at today’s Maraval Rd blitz.', '/community'],
    ['Resident (Kezia/Aaliyah)', 'Rewards: redeem a reward and see the balance and history update.', '/rewards'],
    ['Admin', 'Water Rebates: review Aaliyah’s application – record the inspection, then approve or request info.', '/rebates'],
    ['Anyone', 'Tatil Prototype: send a test sensor message, exactly as the Arduino will.', '/prototype'],
  ]

  return (
    <div>
      <PageHeader eyebrow="For presenters" title="Demo controls">
        Drive the simulation for a live demonstration. Every change here only affects this browser.
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <Section title="Weather (simulated)">
            <Segmented label="Rain" value={s.sim.rain} onChange={(v) => s.setRain(v as RainLevel)} options={[0, 1, 2, 3].map((r) => ({ value: r as RainLevel, label: RAIN_LABEL[r] }))} />
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <CloudRain className="size-4" /> Rainfall: {[0, 5, 20, 50][s.sim.rain]} mm/h · each tick = {s.sim.minutesPerTick} simulated minutes every {s.sim.tickMs / 1000}s
            </p>
          </Section>
          <Section title="Simulation">
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => s.setSim({ running: !s.sim.running })}>
                {s.sim.running ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> Resume</>}
              </button>
              <button className="btn-ghost" onClick={() => s.tick()}>Step once</button>
              <button className="btn-ghost" onClick={() => { s.resetDemo(); toast('success', 'Demo reset') }}>
                <RotateCcw className="size-4" /> Reset all
              </button>
            </div>
            <div className="mt-3">
              <Toggle id="fast" label="Fast mode (tick every 1 s)" checked={s.sim.tickMs === 1000} onChange={(v) => s.setSim({ tickMs: v ? 1000 : 3000 })} />
            </div>
          </Section>
          <Section title="Emergency stop">
            {can(me, 'estop') ? (
              <button className={s.sim.emergencyStop ? 'btn-ghost w-full' : 'btn-danger w-full'} onClick={() => act(s.setEmergencyStop(!s.sim.emergencyStop))}>
                <OctagonX className="size-4" /> {s.sim.emergencyStop ? 'Release emergency stop' : 'Engage emergency stop'}
              </button>
            ) : (
              <p className="text-sm text-muted">Only maintenance staff and administrators can use the emergency stop. Switch persona to Devon or the Administrator.</p>
            )}
          </Section>
        </div>
        <Section title="One-click scenarios" action={<Tag tone="amber" icon={<FlaskConical className="size-3" />}>simulated</Tag>}>
          <ul className="space-y-2">
            {scenarios.map((sc) => (
              <li key={sc.t} className="flex flex-col gap-2 rounded-2xl border border-sand-100 p-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="font-semibold text-navy-900">{sc.t}</div>
                  <div className="text-xs text-muted">{sc.d}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-teal btn-sm" onClick={sc.go}>Run</button>
                  <Link to={sc.to} className="btn-ghost btn-sm">View <ChevronRight className="size-4" /></Link>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
      <Section title="Suggested 5-minute walkthrough" className="mt-5">
        <ol className="space-y-2">
          {script.map(([who, what, to], i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-900 text-[13px] font-bold text-white">{i + 1}</span>
              <div className="text-sm">
                <b className="text-navy-900">{who}:</b> {what}{' '}
                <Link to={to} className="font-semibold text-teal-700">Go →</Link>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )
}
