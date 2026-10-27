import { useState } from 'react'
import { CalendarDays, Camera, CircleCheck, LocateFixed, MapPin, Megaphone, Plus, Users } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe, useNameOf } from '../store/hooks'
import { can } from '../domain/rbac'
import { fmtDateTime, timeAgo } from '../domain/calc'
import { AssetMap } from '../components/AssetMap'
import { Empty, Field, Modal, PageHeader, Section, Segmented, Tag, Timeline } from '../components/ui'
import { useAct } from '../components/Toasts'
import type { CitizenReport, CleanupEvent, ReportCategory, ReportStatus } from '../domain/types'

export const CATEGORY_LABEL: Record<ReportCategory, string> = {
  'flooded-road': 'Flooded road',
  'blocked-drain': 'Blocked drain',
  'overflowing-drain': 'Overflowing drain',
  litter: 'Accumulated litter',
  'basket-full': 'Full / obstructed drain basket',
  'public-leak': 'Leak in public infrastructure',
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  verified: 'Verified',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
  unable_to_verify: 'Unable to verify',
}

const NEXT: Partial<Record<ReportStatus, ReportStatus[]>> = {
  submitted: ['under_review', 'duplicate', 'rejected'],
  under_review: ['verified', 'unable_to_verify', 'duplicate', 'rejected'],
  verified: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['resolved'],
}

const FLOW: ReportStatus[] = ['submitted', 'under_review', 'verified', 'assigned', 'in_progress', 'resolved']

export default function Community() {
  const [tab, setTab] = useState<'reports' | 'cleanups'>('reports')
  return (
    <div>
      <PageHeader eyebrow="Feature 4" title="Community action">
        Report drainage problems, follow their progress, and join cleanups. Points are only awarded after staff verify a report or your attendance.
      </PageHeader>
      <div className="mb-5">
        <Segmented label="Section" value={tab} onChange={setTab} options={[{ value: 'reports', label: 'Citizen reports' }, { value: 'cleanups', label: 'Cleanup events' }]} />
      </div>
      {tab === 'reports' ? <Reports /> : <Cleanups />}
    </div>
  )
}

function Reports() {
  const me = useMe()
  const reports = useStore((s) => s.reports)
  const staff = can(me, 'report:verify')
  const [open, setOpen] = useState(false)
  const mine = reports.filter((r) => r.reporterId === me.id)
  const queue = reports.filter((r) => !['resolved', 'rejected', 'duplicate', 'unable_to_verify'].includes(r.status))
  const publicList = reports.filter((r) => ['verified', 'assigned', 'in_progress', 'resolved'].includes(r.status) && r.reporterId !== me.id)
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl bg-navy-900 p-5 text-white sm:flex-row sm:items-center">
        <Megaphone className="size-8 text-teal-400" aria-hidden />
        <div className="flex-1">
          <div className="display text-2xl">See a problem? Report it.</div>
          <div className="text-sm text-white/75">Flooding, blocked or overflowing drains, dumped litter, full drain baskets, leaking public pipes.</div>
        </div>
        <button className="btn bg-teal-400 text-navy-950 hover:bg-teal-500" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New report
        </button>
      </div>
      <ReportForm open={open} onClose={() => setOpen(false)} />

      {staff && (
        <Section title={`Review queue (${queue.length})`}>
          {queue.length === 0 ? <p className="text-sm text-muted">Nothing waiting.</p> : <div className="space-y-3">{queue.map((r) => <ReportCard key={r.id} r={r} staffView />)}</div>}
        </Section>
      )}
      <Section title="My reports">
        {mine.length === 0 ? (
          <Empty icon={<MapPin className="size-6" />} title="You haven’t reported anything yet" />
        ) : (
          <div className="space-y-3">
            {mine.map((r) => (
              <ReportCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </Section>
      <Section title="Verified in the community">
        <p className="mb-3 text-xs text-muted">Reporter names and exact locations are not shown publicly.</p>
        <div className="space-y-2">
          {publicList.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl bg-sand-50 p-3">
              <MapPin className="size-4 text-teal-700" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-navy-900">{CATEGORY_LABEL[r.category]}</div>
                <div className="truncate text-xs text-muted">
                  {r.locationText} · {timeAgo(r.createdAt)}
                </div>
              </div>
              <Tag tone={r.status === 'resolved' ? 'green' : 'teal'}>{STATUS_LABEL[r.status]}</Tag>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function ReportCard({ r, staffView }: { r: CitizenReport; staffView?: boolean }) {
  const me = useMe()
  const nameOf = useNameOf()
  const tr = useStore((s) => s.reportTransition)
  const act = useAct()
  const [note, setNote] = useState('')
  const [team, setTeam] = useState('Drainage crew A (demo)')
  const idx = FLOW.indexOf(r.status)
  const next = staffView && r.reporterId !== me.id ? (NEXT[r.status] ?? []) : []
  return (
    <article className="rounded-2xl border border-sand-100 p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-navy-900">{CATEGORY_LABEL[r.category]}</div>
          <div className="text-xs text-muted">
            {r.id.toUpperCase()} · {r.locationText} · {fmtDateTime(r.createdAt)}
            {staffView && ` · by ${nameOf(r.reporterId)}`}
          </div>
        </div>
        <Tag tone={r.status === 'resolved' ? 'green' : ['rejected', 'duplicate', 'unable_to_verify'].includes(r.status) ? 'gray' : 'teal'}>{STATUS_LABEL[r.status]}</Tag>
      </div>
      <p className="mt-2 text-sm text-ink">{r.description}</p>
      {r.photoName && <div className="mt-1 text-xs text-muted"><Camera className="mr-1 inline size-3.5" />Photo attached ({r.photoName}) – visible to staff only</div>}
      {r.possibleDuplicateOf && <div className="mt-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs text-amber-700">Possible duplicate of {r.possibleDuplicateOf.toUpperCase()} (same issue reported nearby recently)</div>}
      {idx >= 0 && (
        <ol className="mt-3 flex gap-1" aria-label="Progress">
          {FLOW.map((st, i) => (
            <li key={st} className="flex-1">
              <span className={`block h-1.5 rounded-full ${i <= idx ? 'bg-teal-500' : 'bg-sand-100'}`} />
              <span className={`mt-1 hidden text-[10px] font-semibold sm:block ${i <= idx ? 'text-teal-700' : 'text-muted/60'}`}>{STATUS_LABEL[st]}</span>
            </li>
          ))}
        </ol>
      )}
      {r.assignedTeam && <div className="mt-2 text-xs text-muted">Assigned team: <b>{r.assignedTeam}</b></div>}
      {r.resolutionNotes && <div className="mt-1 text-xs text-muted">Resolution: {r.resolutionNotes}</div>}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-teal-700">History</summary>
        <div className="mt-2">
          <Timeline items={r.history} nameOf={(id) => (staffView || id !== r.reporterId ? nameOf(id) : 'You')} />
        </div>
      </details>
      {next.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-sand-100 pt-3">
          <input className="input" placeholder="Note to reporter (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          {next.includes('assigned') && (
            <select className="input" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
              <option>Drainage crew A (demo)</option>
              <option>Drainage crew B (demo)</option>
              <option>Waste collection unit (demo)</option>
            </select>
          )}
          <div className="flex flex-wrap gap-2">
            {next.map((to) => (
              <button key={to} className={['rejected', 'duplicate', 'unable_to_verify'].includes(to) ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'} onClick={() => act(tr(r.id, to, note || undefined, to === 'assigned' ? team : undefined)) && setNote('')}>
                {to === 'verified' ? 'Verify (awards points)' : STATUS_LABEL[to]}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

function ReportForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const submit = useStore((s) => s.submitReport)
  const act = useAct()
  const [cat, setCat] = useState<ReportCategory>('blocked-drain')
  const [desc, setDesc] = useState('')
  const [loc, setLoc] = useState<[number, number] | null>(null)
  const [locText, setLocText] = useState('')
  const [photo, setPhoto] = useState<string | undefined>()
  const [geoMsg, setGeoMsg] = useState('')
  const useGps = () => {
    if (!navigator.geolocation) return setGeoMsg('Location not available on this device')
    setGeoMsg('Locating…')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc([p.coords.latitude, p.coords.longitude])
        setGeoMsg('Location set from your device (used only for this report)')
        if (!locText) setLocText('Near my current location')
      },
      () => setGeoMsg('Permission denied – tap the map instead'),
      { timeout: 8000 },
    )
  }
  return (
    <Modal open={open} onClose={onClose} title="Report a problem" wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!loc) return act({ ok: false, message: 'Tap the map or use your location to set where the problem is' })
          const r = submit({ category: cat, description: desc, lat: loc[0], lng: loc[1], locationText: locText || `${loc[0].toFixed(4)}, ${loc[1].toFixed(4)}`, photoName: photo })
          if (act(r)) {
            setDesc('')
            setLoc(null)
            setLocText('')
            setPhoto(undefined)
            onClose()
          }
        }}
      >
        <Field label="What’s the problem?" htmlFor="cat">
          <select id="cat" className="input" value={cat} onChange={(e) => setCat(e.target.value as ReportCategory)}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" htmlFor="desc">
          <textarea id="desc" className="input min-h-24" required minLength={10} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What do you see? How bad is it?" />
        </Field>
        <div>
          <div className="label">Location</div>
          <AssetMap points={[]} height={220} onPick={(lat, lng) => setLoc([lat, lng])} picked={loc} zoom={15} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={useGps}>
              <LocateFixed className="size-4" /> Use my location
            </button>
            <span className="text-xs text-muted">{loc ? `Selected ${loc[0].toFixed(4)}, ${loc[1].toFixed(4)}` : 'Tap the map to drop a pin'}</span>
          </div>
          {geoMsg && <p className="hint">{geoMsg}</p>}
          <input className="input mt-2" placeholder="Street / landmark (e.g. South Quay near Broadway)" value={locText} onChange={(e) => setLocText(e.target.value)} aria-label="Location description" />
        </div>
        <Field label="Photo (optional)" htmlFor="ph" hint="Demo: the file stays on your device; only its name is recorded.">
          <input id="ph" type="file" accept="image/*" className="input" onChange={(e) => setPhoto(e.target.files?.[0]?.name)} />
        </Field>
        <p className="rounded-xl bg-amber-100 p-3 text-xs text-amber-700">Demo only – this report is not sent to the Regional Corporation or any authority. In an emergency, call the relevant emergency number.</p>
        <button className="btn-primary w-full">Submit report</button>
      </form>
    </Modal>
  )
}

function Cleanups() {
  const me = useMe()
  const s = useStore()
  const act = useAct()
  const nameOf = useNameOf()
  const organiser = can(me, 'cleanup:organize')
  const [community, setCommunity] = useState('all')
  const [creating, setCreating] = useState(false)
  const now = Date.now()
  const list = s.events.filter((e) => community === 'all' || e.communityId === community)
  const upcoming = list.filter((e) => !e.completed && e.end >= now).sort((a, b) => a.start - b.start)
  const past = list.filter((e) => e.completed || e.end < now)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={community} onChange={(e) => setCommunity(e.target.value)} aria-label="Community">
          <option value="all">All communities</option>
          {s.communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {organiser && (
          <button className="btn-teal" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create event
          </button>
        )}
      </div>
      {upcoming.length === 0 && <Empty icon={<CalendarDays className="size-6" />} title="No upcoming cleanups" />}
      {upcoming.map((e) => {
        const reg = e.registrations.some((r) => r.userId === me.id)
        const checked = e.checkins.some((c) => c.userId === me.id)
        const live = now >= e.start - 30 * 60_000 && now <= e.end
        return (
          <article key={e.id} className="card overflow-hidden">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-navy-900 text-center text-white">
                <div>
                  <div className="text-[11px] font-bold uppercase text-teal-400">{new Date(e.start).toLocaleDateString('en-TT', { month: 'short' })}</div>
                  <div className="display text-2xl">{new Date(e.start).getDate()}</div>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-navy-900">{e.title}</h3>
                  {live && <Tag tone="green">Happening now</Tag>}
                  {reg && <Tag tone="teal">Registered</Tag>}
                </div>
                <div className="mt-1 text-sm text-muted">
                  {fmtDateTime(e.start)} – {new Date(e.end).toLocaleTimeString('en-TT', { hour: '2-digit', minute: '2-digit' })} · {e.locationName}
                </div>
                <div className="mt-1 text-sm text-muted">Organiser: {e.organizer} · Bring: {e.equipment.join(', ')}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Tag tone="navy" icon={<Users className="size-3" />}>{e.registrations.length}/{e.capacity} registered</Tag>
                  <Tag tone="green">+{e.points} pts when verified</Tag>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:w-40">
                {me.role === 'resident' &&
                  (reg ? (
                    <>
                      {live && !checked && (
                        <button className="btn-teal" onClick={() => act(s.checkIn(e.id, 'Checked in via app'))}>
                          <CircleCheck className="size-4" /> Check in
                        </button>
                      )}
                      {checked && <Tag tone="green">Checked in ✓</Tag>}
                      <button className="btn-ghost btn-sm" onClick={() => act(s.registerEvent(e.id, false))}>
                        Cancel registration
                      </button>
                    </>
                  ) : (
                    <button className="btn-primary" onClick={() => act(s.registerEvent(e.id, true))}>
                      Register
                    </button>
                  ))}
              </div>
            </div>
            {organiser && (
              <div className="border-t border-sand-100 bg-sand-50/60 p-4 sm:px-5">
                <div className="mb-2 text-sm font-bold text-navy-900">Organiser tools</div>
                <ul className="space-y-1.5">
                  {e.registrations.map((r) => {
                    const ci = e.checkins.find((c) => c.userId === r.userId)
                    const ver = e.verified.find((v) => v.userId === r.userId)
                    return (
                      <li key={r.userId} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{nameOf(r.userId)}</span>
                        {ver ? <Tag tone="green">Verified · points awarded</Tag> : ci ? <button className="btn-teal btn-sm" onClick={() => act(s.verifyAttendance(e.id, r.userId))}>Verify attendance</button> : <Tag tone="gray">Not checked in</Tag>}
                      </li>
                    )
                  })}
                </ul>
                <CompleteEvent e={e} />
              </div>
            )}
          </article>
        )
      })}
      {past.length > 0 && (
        <Section title="Completed events">
          {past.map((e) => (
            <div key={e.id} className="rounded-xl bg-sand-50 p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <b className="text-navy-900">{e.title}</b>
                <span className="text-xs text-muted">{fmtDateTime(e.start)}</span>
              </div>
              <div className="mt-1 text-sm text-muted">{e.summary ?? 'Summary pending.'}</div>
              <div className="mt-1 flex gap-2">
                <Tag tone="navy">{e.verified.length} verified participants</Tag>
                {e.wasteKg !== undefined && <Tag tone="green">{e.wasteKg} kg collected</Tag>}
              </div>
            </div>
          ))}
        </Section>
      )}
      <CreateEvent open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function CompleteEvent({ e }: { e: CleanupEvent }) {
  const complete = useStore((s) => s.completeEvent)
  const act = useAct()
  const [kg, setKg] = useState('')
  const [sum, setSum] = useState('')
  return (
    <form className="mt-3 grid gap-2 sm:grid-cols-[100px_1fr_auto]" onSubmit={(ev) => { ev.preventDefault(); act(complete(e.id, Number(kg), sum || `${e.verified.length} volunteers collected ${kg} kg of waste.`)) }}>
      <input className="input" type="number" min={0} placeholder="kg" value={kg} onChange={(x) => setKg(x.target.value)} aria-label="Waste collected (kg)" required />
      <input className="input" placeholder="Completion summary" value={sum} onChange={(x) => setSum(x.target.value)} aria-label="Summary" />
      <button className="btn-ghost btn-sm">Close event</button>
    </form>
  )
}

function CreateEvent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const act = useAct()
  const [f, setF] = useState({ title: '', communityId: 'c-sq', locationName: '', date: '', time: '07:00', hours: '3', capacity: '40', points: '100', equipment: 'Gloves, closed-toe shoes' })
  const [loc, setLoc] = useState<[number, number] | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal open={open} onClose={onClose} title="Create cleanup" wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const start = new Date(`${f.date}T${f.time}`).getTime()
          if (!loc) return act({ ok: false, message: 'Tap the map to set the meeting point' })
          if (act(s.createEvent({ title: f.title, communityId: f.communityId, locationName: f.locationName, lat: loc[0], lng: loc[1], start, end: start + Number(f.hours) * 3_600_000, organizer: 'Department of Dry Affairs', equipment: f.equipment.split(',').map((x) => x.trim()).filter(Boolean), capacity: Number(f.capacity), points: Number(f.points) }))) onClose()
        }}
      >
        <Field label="Title" htmlFor="et"><input id="et" className="input" required value={f.title} onChange={set('title')} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Community" htmlFor="ec">
            <select id="ec" className="input" value={f.communityId} onChange={set('communityId')}>
              {s.communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Meeting point" htmlFor="el"><input id="el" className="input" required value={f.locationName} onChange={set('locationName')} /></Field>
          <Field label="Date" htmlFor="ed"><input id="ed" className="input" type="date" required value={f.date} onChange={set('date')} /></Field>
          <Field label="Start time" htmlFor="es"><input id="es" className="input" type="time" required value={f.time} onChange={set('time')} /></Field>
          <Field label="Duration (h)" htmlFor="eh"><input id="eh" className="input" type="number" min={1} value={f.hours} onChange={set('hours')} /></Field>
          <Field label="Capacity" htmlFor="ecap"><input id="ecap" className="input" type="number" min={1} value={f.capacity} onChange={set('capacity')} /></Field>
          <Field label="Points (verified)" htmlFor="ep"><input id="ep" className="input" type="number" min={0} value={f.points} onChange={set('points')} /></Field>
          <Field label="Equipment" htmlFor="eq"><input id="eq" className="input" value={f.equipment} onChange={set('equipment')} /></Field>
        </div>
        <AssetMap points={[]} height={200} onPick={(a, b) => setLoc([a, b])} picked={loc} />
        <button className="btn-primary w-full">Create event</button>
      </form>
    </Modal>
  )
}
