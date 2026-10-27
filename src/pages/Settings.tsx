import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { useMe, useNameOf, useNow } from '../store/hooks'
import { can, ROLE_LABEL } from '../domain/rbac'
import { deviceHealth, fmtDateTime, timeAgo } from '../domain/calc'
import { Field, PageHeader, Section, Tag, Toggle } from '../components/ui'
import { useAct } from '../components/Toasts'
import type { Role, User } from '../domain/types'

type TabId = 'profile' | 'notifications' | 'accessibility' | 'privacy' | 'users' | 'devices' | 'locations' | 'audit'

export default function Settings() {
  const me = useMe()
  const { tab = 'profile' } = useParams()
  const nav = useNavigate()
  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'profile', label: 'Profile', show: true },
    { id: 'notifications', label: 'Notifications', show: true },
    { id: 'accessibility', label: 'Accessibility', show: true },
    { id: 'privacy', label: 'Data & privacy', show: true },
    { id: 'devices', label: 'Devices', show: can(me, 'maintenance:view') || can(me, 'admin:devices') },
    { id: 'users', label: 'Users & roles', show: can(me, 'admin:users') },
    { id: 'locations', label: 'Locations', show: can(me, 'admin:devices') },
    { id: 'audit', label: 'Audit log', show: can(me, 'audit:view') },
  ]
  const visible = tabs.filter((t) => t.show)
  const current = (visible.find((t) => t.id === tab)?.id ?? 'profile') as TabId
  return (
    <div>
      <PageHeader eyebrow={ROLE_LABEL[me.role]} title="Settings" />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-sand-100 p-1 scrollbar-none" role="tablist">
        {visible.map((t) => (
          <button key={t.id} role="tab" aria-selected={current === t.id} onClick={() => nav(`/settings/${t.id}`)} className={`min-h-10 shrink-0 rounded-lg px-3 text-[13px] font-semibold ${current === t.id ? 'bg-white text-navy-900 shadow-sm' : 'text-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {current === 'profile' && <Profile />}
      {current === 'notifications' && <NotifPrefs />}
      {current === 'accessibility' && <Access />}
      {current === 'privacy' && <Privacy />}
      {current === 'devices' && <Devices />}
      {current === 'users' && <Users />}
      {current === 'locations' && <Locations />}
      {current === 'audit' && <Audit />}
    </div>
  )
}

function Profile() {
  const me = useMe()
  const s = useStore()
  const act = useAct()
  const [name, setName] = useState(me.name)
  const [comm, setComm] = useState(me.communityId)
  return (
    <Section title="Profile">
      <form className="grid max-w-lg gap-3" onSubmit={(e) => { e.preventDefault(); act(s.updateUser(me.id, { name, communityId: comm })) }}>
        <Field label="Display name" htmlFor="pn"><input id="pn" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" htmlFor="pe" hint="Fictional demo address"><input id="pe" className="input" value={me.email} disabled /></Field>
        <Field label="Community" htmlFor="pc">
          <select id="pc" className="input" value={comm} onChange={(e) => setComm(e.target.value)}>
            {s.communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Toggle id="pr" label="Show my name on community leaderboards" checked={me.publicRecognition} onChange={(v) => act(s.updateUser(me.id, { publicRecognition: v }))} />
        <button className="btn-primary">Save profile</button>
      </form>
    </Section>
  )
}

function NotifPrefs() {
  const me = useMe()
  const s = useStore()
  const p = me.notificationPrefs
  const set = (k: keyof User['notificationPrefs']) => (v: boolean) => s.updateUser(me.id, { notificationPrefs: { ...p, [k]: v } })
  const items: [keyof User['notificationPrefs'], string][] = [
    ['tank', 'Tank capacity alerts'],
    ['leak', 'Suspected leaks'],
    ['drain', 'Elevated drain levels'],
    ['device', 'Device disconnections & faults'],
    ['maintenance', 'Maintenance assignments'],
    ['community', 'Cleanups & report updates'],
    ['rewards', 'Reward transactions'],
    ['rebates', 'Rebate application updates'],
  ]
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Section title="What to notify me about">
        {items.map(([k, l]) => <Toggle key={k} id={`n-${k}`} label={l} checked={p[k]} onChange={set(k)} />)}
        <p className="hint">Critical safety alerts are always delivered.</p>
      </Section>
      <Section title="Channels">
        <Toggle id="n-app" label="In-app (always on)" checked disabled onChange={() => {}} />
        <Toggle id="n-email" label="Email (simulated – no provider configured)" checked={p.channelEmail} onChange={set('channelEmail')} />
        <Toggle id="n-sms" label="SMS (simulated – no provider configured)" checked={p.channelSms} onChange={set('channelSms')} />
        <p className="hint">To send real messages, configure an email/SMS provider on the backend (see README → Notifications).</p>
      </Section>
    </div>
  )
}

function Access() {
  const me = useMe()
  const s = useStore()
  const a = me.accessibility
  return (
    <Section title="Accessibility">
      <Toggle id="a-lt" label="Larger text" checked={a.largeText} onChange={(v) => s.updateUser(me.id, { accessibility: { ...a, largeText: v } })} />
      <Toggle id="a-rm" label="Reduce motion (stops water & rain animations)" checked={a.reduceMotion} onChange={(v) => s.updateUser(me.id, { accessibility: { ...a, reduceMotion: v } })} />
      <p className="hint">Statuses always use an icon and text label, never colour alone.</p>
    </Section>
  )
}

function Privacy() {
  const s = useStore()
  const act = useAct()
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Section title="How data is handled (demo policy)">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
          <li>Household tank data is visible only to its owner and authorised staff.</li>
          <li>Exact private property locations are never shown on public maps; public report locations are rounded to ≈100 m.</li>
          <li>Only the last 4 digits of a utility account are collected; full numbers are never stored.</li>
          <li>Photos stay on your device in this demo. In production, uploads would be virus-scanned, stripped of location metadata and visible only to staff.</li>
          <li>Proposed retention: sensor readings 5 years (aggregated after 1 year); reports 3 years; rebate records per sponsor/legal requirements; accounts deleted on request.</li>
          <li>Leaderboard names appear only with your consent.</li>
        </ul>
      </Section>
      <Section title="This browser’s demo data">
        <p className="text-sm text-muted">Everything you do in this demo is stored only in this browser. Nobody else sees your changes.</p>
        <button className="btn-danger mt-3" onClick={() => { s.resetDemo(); act({ ok: true, message: 'Demo reset to its starting state' }) }}>
          Reset demo data
        </button>
      </Section>
    </div>
  )
}

function Devices() {
  const me = useMe()
  const now = useNow(3000)
  const s = useStore()
  const act = useAct()
  const admin = can(me, 'admin:devices')
  const assetName = (id: string) => s.tanks.find((t) => t.id === id)?.name ?? s.drains.find((d) => d.id === id)?.name ?? s.valves.find((v) => v.id === id)?.id ?? id
  return (
    <Section title={`Device registry (${s.devices.length})`}>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-sand-100">
              <th className="px-4 py-2">Device</th>
              <th className="py-2">Type</th>
              <th className="py-2">Asset</th>
              <th className="py-2">Model / firmware</th>
              <th className="py-2">Last seen</th>
              <th className="py-2">Status</th>
              <th className="py-2">Source</th>
              {admin && <th className="py-2">Enabled</th>}
            </tr>
          </thead>
          <tbody>
            {s.devices.map((d) => {
              const h = deviceHealth(d, now)
              return (
                <tr key={d.id} className="border-b border-sand-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{d.id}</td>
                  <td className="py-2">{d.kind}</td>
                  <td className="py-2">{assetName(d.assetId)}</td>
                  <td className="py-2 text-xs text-muted">{d.model}<br />v{d.firmware}{d.battery !== undefined && ` · ${d.battery}% batt.`}</td>
                  <td className="py-2 text-xs">{timeAgo(d.lastSeen, now)}</td>
                  <td className="py-2"><Tag tone={h === 'online' ? 'green' : h === 'stale' ? 'amber' : h === 'fault' ? 'red' : 'gray'}>{h}</Tag></td>
                  <td className="py-2"><Tag tone={d.source === 'live' ? 'green' : 'amber'}>{d.source}</Tag></td>
                  {admin && (
                    <td className="py-2">
                      <input type="checkbox" className="size-5 accent-teal-600" checked={d.enabled} onChange={(e) => act(s.setDeviceEnabled(d.id, e.target.checked))} aria-label={`Enable ${d.id}`} />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">Devices authenticate with per-device keys in production (see README → Sensor API). <Link to="/prototype" className="text-teal-700 underline">Connect the Tatil prototype →</Link></p>
    </Section>
  )
}

function Users() {
  const me = useMe()
  const s = useStore()
  const act = useAct()
  return (
    <Section title="Users & roles">
      <ul className="divide-y divide-sand-100">
        {s.users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-navy-900">{u.name} {u.id === me.id && <Tag tone="teal">you</Tag>}</div>
              <div className="text-xs text-muted">{u.email} · {u.title}</div>
            </div>
            <select className="input w-auto" value={u.role} disabled={u.id === me.id} onChange={(e) => act(s.updateUser(u.id, { role: e.target.value as Role }))} aria-label={`Role for ${u.name}`}>
              {(['resident', 'maintenance', 'admin'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <button className={u.disabled ? 'btn-teal btn-sm' : 'btn-ghost btn-sm'} disabled={u.id === me.id} onClick={() => act(s.updateUser(u.id, { disabled: !u.disabled }))}>
              {u.disabled ? 'Enable' : 'Disable'}
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">Permissions: residents see only their own tanks and applications; maintenance staff handle drains, leaks, reports and tasks; administrators configure thresholds, rewards, rebates, users and devices. Nobody can approve their own rebate or verify their own report.</p>
    </Section>
  )
}

function Locations() {
  const s = useStore()
  const act = useAct()
  return (
    <Section title="Buildings & communities">
      <ul className="space-y-3">
        {s.buildings.map((b) => (
          <li key={b.id} className="rounded-xl bg-sand-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-navy-900">{b.name}</b>
              <Tag tone={b.publicLocation ? 'teal' : 'gray'}>{b.publicLocation ? 'public location' : 'private location'}</Tag>
              {b.isPrototypeSite && <Tag tone="navy">prototype site</Tag>}
            </div>
            <div className="text-xs text-muted">{b.address} · {s.communities.find((c) => c.id === b.communityId)?.name}</div>
            <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); act(s.updateBuilding(b.id, { lat: Number(f.get('lat')), lng: Number(f.get('lng')) })) }}>
              <label className="text-xs">Lat <input name="lat" className="input w-32" defaultValue={b.lat} /></label>
              <label className="text-xs">Lng <input name="lng" className="input w-32" defaultValue={b.lng} /></label>
              <button className="btn-ghost btn-sm">Save</button>
            </form>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Audit() {
  const s = useStore()
  const nameOf = useNameOf()
  const [q, setQ] = useState('')
  const rows = s.audit.filter((a) => `${a.action} ${a.target} ${a.detail} ${nameOf(a.actorId)}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <Section title="Audit log">
      <input className="input mb-3 max-w-sm" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter audit log" />
      <ul className="divide-y divide-sand-100 text-sm">
        {rows.slice(0, 200).map((a) => (
          <li key={a.id} className="grid gap-1 py-2 sm:grid-cols-[150px_160px_1fr]">
            <span className="text-xs text-muted">{fmtDateTime(a.t)}</span>
            <span className="font-mono text-xs text-navy-900">{a.action}</span>
            <span className="text-xs">
              <b>{nameOf(a.actorId)}</b> → {a.target} {a.detail && <span className="text-muted">· {a.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">Entries are append-only; historical records are never edited.</p>
    </Section>
  )
}
