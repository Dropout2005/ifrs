import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Siren, FlaskConical, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe, useNameOf, useVisibleTanks } from '../store/hooks'
import { can } from '../domain/rbac'
import { fmtDateTime, timeAgo } from '../domain/calc'
import { isLeakOpen, LEAK_LABEL, LEAK_TRANSITIONS } from '../domain/leak'
import { Empty, PageHeader, Segmented, Tag, Timeline } from '../components/ui'
import { useAct } from '../components/Toasts'
import type { LeakAlert, LeakStatus } from '../domain/types'

const METHOD: Record<LeakAlert['method'], string> = {
  'leak-sensor': 'Dedicated leak probe',
  'level-discrepancy': 'Unexplained tank-level drop',
  'unexpected-flow': 'Unexpected flow',
  'usage-discrepancy': 'Usage discrepancy',
}

const STEPS: LeakStatus[] = ['suspected', 'acknowledged', 'inspecting', 'confirmed', 'resolved']

export default function Leaks() {
  const me = useMe()
  const tanks = useVisibleTanks()
  const leaks = useStore((s) => s.leaks)
  const setProbe = useStore((s) => s.setLeakProbe)
  const setSimLeak = useStore((s) => s.setSimLeak)
  const toast = useStore((s) => s.toast)
  const [tab, setTab] = useState<'open' | 'closed'>('open')
  const ids = new Set(tanks.map((t) => t.id))
  const mine = leaks.filter((l) => ids.has(l.tankId))
  const list = mine.filter((l) => (tab === 'open' ? isLeakOpen(l.status) : !isLeakOpen(l.status)))
  const simTanks = tanks.filter((t) => t.leakDeviceId)
  const [simTank, setSimTank] = useState(simTanks[0]?.id ?? '')

  return (
    <div>
      <PageHeader eyebrow="Feature 3" title="Leak detection">
        IFRS raises a <b>suspected</b> leak when a leak probe gets wet, or when a tank loses water that can’t be explained by recorded use, release or rain for several readings in a row. A single drop never triggers an alert.
      </PageHeader>

      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="card flex flex-wrap items-center gap-2 border-2 border-dashed border-amber-500/50 p-3">
          <FlaskConical className="size-5 text-amber-700" />
          <span className="text-sm font-semibold text-navy-900">Try it:</span>
          <select className="input w-auto" value={simTank} onChange={(e) => setSimTank(e.target.value)} aria-label="Tank to simulate">
            {simTanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn-ghost btn-sm" disabled={!simTank} onClick={() => { setProbe(simTank, true); toast('info', 'Leak probe activated – alert raised') }}>
            Wet leak probe
          </button>
          <button className="btn-ghost btn-sm" disabled={!simTank} onClick={() => { const t = tanks.find((x) => x.id === simTank)!; setSimLeak(simTank, Math.max(2, t.capacityL * 0.0012)); toast('info', 'Hidden leak started – watch for an alert after a few readings') }}>
            Start hidden leak
          </button>
        </div>
        <Segmented label="Show" value={tab} onChange={setTab} options={[{ value: 'open', label: `Open (${mine.filter((l) => isLeakOpen(l.status)).length})` }, { value: 'closed', label: 'Closed' }]} />
      </div>

      {list.length === 0 ? (
        <Empty icon={<ShieldCheck className="size-6" />} title={tab === 'open' ? 'No open leak alerts' : 'No closed alerts yet'}>
          {tab === 'open' ? 'Everything looks dry. Use the controls above to simulate a leak.' : 'Resolved and false-alarm alerts appear here.'}
        </Empty>
      ) : (
        <div className="space-y-4">
          {list.map((l) => (
            <LeakCard key={l.id} leak={l} staff={can(me, 'leak:workflow')} />
          ))}
        </div>
      )}
    </div>
  )
}

function LeakCard({ leak, staff }: { leak: LeakAlert; staff: boolean }) {
  const me = useMe()
  const nameOf = useNameOf()
  const tank = useStore((s) => s.tanks.find((t) => t.id === leak.tankId))
  const tr = useStore((s) => s.leakTransition)
  const act = useAct()
  const [note, setNote] = useState('')
  const isOwner = tank?.ownerId === me.id
  const next = LEAK_TRANSITIONS[leak.status].filter((to) => (to === 'acknowledged' ? isOwner || staff : staff))
  const stepIdx = STEPS.indexOf(leak.status === 'escalated' ? 'confirmed' : leak.status === 'false_alarm' ? 'resolved' : leak.status)
  return (
    <article className="card overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 p-4 sm:p-5">
        <div className={`grid size-11 place-items-center rounded-2xl ${isLeakOpen(leak.status) ? 'bg-amber-100 text-amber-700' : 'bg-leaf-100 text-leaf-600'}`}>
          <Siren className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-navy-900">{tank ? <Link to={`/tanks/${tank.id}`} className="hover:underline">{tank.name}</Link> : leak.tankId}</h2>
            <Tag tone={isLeakOpen(leak.status) ? 'amber' : leak.status === 'false_alarm' ? 'gray' : 'green'}>{LEAK_LABEL[leak.status]}</Tag>
            <Tag tone={leak.severity === 'high' ? 'red' : leak.severity === 'medium' ? 'amber' : 'gray'}>{leak.severity} severity</Tag>
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {leak.id.toUpperCase()} · {METHOD[leak.method]} · detected {fmtDateTime(leak.detectedAt)} ({timeAgo(leak.detectedAt)})
          </div>
          <p className="mt-2 rounded-xl bg-sand-50 p-3 text-sm text-ink">
            <b>Evidence:</b> {leak.evidence}
          </p>
        </div>
      </div>
      {/* progress */}
      <ol className="flex border-y border-sand-100 bg-sand-50/60 px-4 py-2 text-[11px] font-semibold" aria-label="Workflow progress">
        {STEPS.map((st, i) => (
          <li key={st} className={`flex-1 text-center ${i <= stepIdx ? 'text-teal-700' : 'text-muted/60'}`} aria-current={i === stepIdx ? 'step' : undefined}>
            <span className={`mx-auto mb-1 block h-1.5 rounded-full ${i <= stepIdx ? 'bg-teal-500' : 'bg-sand-100'}`} />
            {LEAK_LABEL[st]}
          </li>
        ))}
      </ol>
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
        <Timeline items={leak.timeline} nameOf={nameOf} />
        <div>
          {next.length > 0 ? (
            <div className="space-y-2">
              <input className="input" placeholder="Note (what you found / did)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
              <div className="flex flex-wrap gap-2">
                {next.map((to) => (
                  <button key={to} className={to === 'false_alarm' ? 'btn-ghost btn-sm' : to === 'escalated' ? 'btn-danger btn-sm' : 'btn-primary btn-sm'} onClick={() => act(tr(leak.id, to, note || undefined)) && setNote('')}>
                    {to === 'acknowledged' ? 'Acknowledge' : to === 'inspecting' ? 'Start inspection' : to === 'confirmed' ? 'Confirm leak' : to === 'false_alarm' ? 'Mark false alarm' : to === 'escalated' ? 'Escalate' : 'Mark repaired & close'}
                  </button>
                ))}
              </div>
              {!staff && leak.status !== 'suspected' && <p className="text-xs text-muted">The maintenance team will inspect and update this alert.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">{isLeakOpen(leak.status) ? 'Waiting for the maintenance team.' : 'This alert is closed.'}</p>
          )}
          {leak.maintenanceTaskId && (
            <Link to="/maintenance" className="mt-3 inline-block text-[13px] font-semibold text-teal-700">
              Repair task {leak.maintenanceTaskId.toUpperCase()} →
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
