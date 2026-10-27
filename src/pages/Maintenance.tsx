import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HardHat, Lock, Plus, OctagonX } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe, useNameOf, useNow } from '../store/hooks'
import { can } from '../domain/rbac'
import { basketOverdue, blockageSignals, deviceHealth, fmtDateTime, timeAgo } from '../domain/calc'
import { isLeakOpen } from '../domain/leak'
import { Empty, Field, Modal, PageHeader, Segmented, Tag, Timeline } from '../components/ui'
import { useAct } from '../components/Toasts'
import type { MaintenanceTask, TaskStatus } from '../domain/types'

export default function Maintenance() {
  const me = useMe()
  const now = useNow(5000)
  const s = useStore()
  const act = useAct()
  const [filter, setFilter] = useState<'mine' | 'open' | 'done'>('open')
  const [creating, setCreating] = useState(false)
  if (!can(me, 'maintenance:view'))
    return (
      <Empty icon={<Lock className="size-6" />} title="Staff only">
        Maintenance tools are available to municipal and maintenance staff. Switch persona to “Devon · Maintenance” to explore.
      </Empty>
    )
  const tasks = s.tasks.filter((t) => (filter === 'done' ? ['done', 'cancelled'].includes(t.status) : !['done', 'cancelled'].includes(t.status) && (filter === 'open' || t.assigneeId === me.id)))
  const overdue = s.drains.filter((d) => basketOverdue(d, now))
  const suspected = s.drains.filter((d) => !d.blockageConfirmed && blockageSignals(d, s.sim.rain, now).length > 0 && deviceHealth(s.devices.find((x) => x.id === d.deviceId), now) === 'online')
  const badDev = s.devices.filter((d) => ['offline', 'fault'].includes(deviceHealth(d, now)))
  const leaks = s.leaks.filter((l) => isLeakOpen(l.status))
  const valveFaults = s.valves.filter((v) => v.state === 'fault')

  return (
    <div>
      <PageHeader
        eyebrow="Staff"
        title="Maintenance"
        actions={
          <>
            <button className="btn-teal" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New task
            </button>
            {can(me, 'estop') && (
              <button className={s.sim.emergencyStop ? 'btn-ghost' : 'btn-danger'} onClick={() => act(s.setEmergencyStop(!s.sim.emergencyStop))}>
                <OctagonX className="size-4" /> {s.sim.emergencyStop ? 'Release emergency stop' : 'Emergency stop all valves'}
              </button>
            )}
          </>
        }
      >
        Assigned work, inspections and anything the sensors think needs a look.
      </PageHeader>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Attention title="Baskets overdue" items={overdue.map((d) => ({ k: d.id, label: d.name, to: `/drains/${d.id}` }))} tone="amber" />
        <Attention title="Suspected blockages" items={suspected.map((d) => ({ k: d.id, label: d.name, to: `/drains/${d.id}` }))} tone="red" />
        <Attention title="Devices offline / fault" items={badDev.map((d) => ({ k: d.id, label: `${d.id} (${deviceHealth(d, now)})`, to: '/settings/devices' }))} tone="amber" />
        <Attention title="Open leak alerts" items={leaks.map((l) => ({ k: l.id, label: s.tanks.find((t) => t.id === l.tankId)?.name ?? l.tankId, to: '/leaks' }))} tone="amber" />
        <Attention title="Valve faults" items={valveFaults.map((v) => ({ k: v.id, label: s.tanks.find((t) => t.id === v.tankId)?.name ?? v.id, to: `/tanks/${v.tankId}` }))} tone="red" />
      </div>

      <div className="mb-3">
        <Segmented label="Tasks" value={filter} onChange={setFilter} options={[{ value: 'open', label: 'All open' }, { value: 'mine', label: 'Assigned to me' }, { value: 'done', label: 'Completed' }]} />
      </div>
      {tasks.length === 0 ? (
        <Empty icon={<HardHat className="size-6" />} title="No tasks here" />
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <TaskCard key={t.id} t={t} />
          ))}
        </div>
      )}
      <NewTask open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function Attention({ title, items, tone }: { title: string; items: { k: string; label: string; to: string }[]; tone: 'amber' | 'red' }) {
  return (
    <div className={`card p-3 ${items.length ? (tone === 'red' ? 'border-danger-500/40' : 'border-amber-500/40') : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-navy-900">{title}</span>
        <Tag tone={items.length ? tone : 'green'}>{items.length}</Tag>
      </div>
      <ul className="mt-1 space-y-0.5">
        {items.slice(0, 3).map((i) => (
          <li key={i.k}>
            <Link to={i.to} className="block truncate text-xs text-teal-700 hover:underline">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TaskCard({ t }: { t: MaintenanceTask }) {
  const s = useStore()
  const nameOf = useNameOf()
  const act = useAct()
  const [note, setNote] = useState('')
  const staff = s.users.filter((u) => u.role !== 'resident' && !u.disabled)
  const assetLink = t.assetType === 'drain' ? `/drains/${t.assetId}` : t.assetType === 'tank' ? `/tanks/${t.assetId}` : t.assetType === 'valve' ? `/tanks/${s.valves.find((v) => v.id === t.assetId)?.tankId}` : '/settings/devices'
  const next: TaskStatus[] = t.status === 'open' || t.status === 'assigned' ? ['in_progress', 'cancelled'] : t.status === 'in_progress' ? ['done'] : []
  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-navy-900">{t.title}</div>
          <div className="text-xs text-muted">
            {t.id.toUpperCase()} · <Link to={assetLink} className="text-teal-700 underline">{t.assetType} {t.assetId}</Link> · {t.source} · created {timeAgo(t.createdAt)}
            {t.dueAt && ` · due ${fmtDateTime(t.dueAt)}`}
          </div>
        </div>
        <Tag tone={t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'amber' : 'gray'}>{t.priority}</Tag>
        <Tag tone={t.status === 'done' ? 'green' : 'teal'}>{t.status.replace('_', ' ')}</Tag>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>{t.notes.length ? <Timeline items={t.notes} nameOf={nameOf} /> : <p className="text-xs text-muted">No notes yet.</p>}</div>
        {!['done', 'cancelled'].includes(t.status) && (
          <div className="space-y-2">
            <select className="input" value={t.assigneeId ?? ''} onChange={(e) => act(s.updateTask(t.id, { assigneeId: e.target.value }))} aria-label="Assignee">
              <option value="">Unassigned</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <input className="input" placeholder="Work notes / findings" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Work notes" />
            <input className="input text-xs" type="file" accept="image/*" aria-label="Attach photo (demo – not uploaded)" />
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost btn-sm" disabled={!note} onClick={() => act(s.updateTask(t.id, { note })) && setNote('')}>
                Add note
              </button>
              {next.map((st) => (
                <button key={st} className={st === 'cancelled' ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'} onClick={() => act(s.updateTask(t.id, { status: st, note: note || undefined })) && setNote('')}>
                  {st === 'in_progress' ? 'Start work' : st === 'done' ? 'Mark complete' : 'Cancel'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function NewTask({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const toast = useStore((x) => x.toast)
  const [f, setF] = useState({ title: '', asset: `drain:${s.drains[0]?.id}`, priority: 'medium', assignee: '' })
  return (
    <Modal open={open} onClose={onClose} title="New maintenance task">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const [assetType, assetId] = f.asset.split(':')
          s.createTask({ title: f.title, assetType: assetType as never, assetId, priority: f.priority as never, assigneeId: f.assignee || undefined, source: 'Manual' })
          toast('success', 'Task created')
          onClose()
        }}
      >
        <Field label="Title" htmlFor="tt"><input id="tt" className="input" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Asset" htmlFor="ta">
          <select id="ta" className="input" value={f.asset} onChange={(e) => setF({ ...f, asset: e.target.value })}>
            <optgroup label="Drains">{s.drains.map((d) => <option key={d.id} value={`drain:${d.id}`}>{d.name}</option>)}</optgroup>
            <optgroup label="Tanks">{s.tanks.map((t) => <option key={t.id} value={`tank:${t.id}`}>{t.name}</option>)}</optgroup>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Priority" htmlFor="tp">
            <select id="tp" className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </Field>
          <Field label="Assign to" htmlFor="tas">
            <select id="tas" className="input" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
              <option value="">Unassigned</option>
              {s.users.filter((u) => u.role !== 'resident').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <button className="btn-primary w-full">Create task</button>
      </form>
    </Modal>
  )
}
