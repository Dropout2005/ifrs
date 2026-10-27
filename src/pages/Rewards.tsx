import { useState } from 'react'
import { Award, Gift, Medal, Trophy, Lock } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe } from '../store/hooks'
import { can } from '../domain/rbac'
import { balance, checkRedeem, lifetimeEarned } from '../domain/rewards'
import { fmtDate, fmtDateTime } from '../domain/calc'
import { Modal, PageHeader, Progress, Section, Tag } from '../components/ui'
import { useAct } from '../components/Toasts'
import type { Reward } from '../domain/types'

const MILESTONES = [
  { pts: 25, name: 'First Report', desc: 'A report verified by staff' },
  { pts: 100, name: 'Drain Defender', desc: 'Earn 100 points' },
  { pts: 250, name: 'Rain Channeler', desc: 'Earn 250 points' },
  { pts: 500, name: 'Terrain Protector', desc: 'Earn 500 points' },
]

export default function Rewards() {
  const me = useMe()
  const s = useStore()
  const act = useAct()
  const [confirm, setConfirm] = useState<Reward | null>(null)
  const bal = balance(s.pointsTx, me.id)
  const life = lifetimeEarned(s.pointsTx, me.id)
  const myTx = s.pointsTx.filter((t) => t.userId === me.id)
  const residents = s.users.filter((u) => u.role === 'resident')
  const board = residents.map((u) => ({ u, pts: lifetimeEarned(s.pointsTx, u.id) })).sort((a, b) => b.pts - a.pts)
  const goalKg = 500
  const doneKg = s.events.reduce((a, e) => a + (e.wasteKg ?? 0), 0)
  const resident = me.role === 'resident'

  return (
    <div>
      <PageHeader eyebrow="Feature 4" title="Rewards">
        Points are earned only for <b>verified</b> activities, and each activity can be rewarded once. Rewards shown are examples; anything with monetary value requires a funded sponsor.
      </PageHeader>

      {resident && (
        <div className="mb-5 grid gap-4 md:grid-cols-[1fr_1.3fr]">
          <div className="relative overflow-hidden rounded-3xl bg-navy-900 p-6 text-white">
            <div className="absolute -right-6 -top-6 size-40 rounded-full bg-teal-400/20" aria-hidden />
            <div className="text-sm text-white/70">Your balance</div>
            <div className="display mt-1 text-6xl tabular-nums">{bal}</div>
            <div className="text-sm text-white/70">points · {life} earned all-time</div>
          </div>
          <Section title="Achievements">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MILESTONES.map((m) => {
                const got = life >= m.pts
                return (
                  <div key={m.name} className={`rounded-2xl p-3 text-center ${got ? 'bg-teal-50' : 'bg-sand-50'}`}>
                    {got ? <Medal className="mx-auto size-7 text-teal-700" aria-hidden /> : <Lock className="mx-auto size-7 text-muted/50" aria-hidden />}
                    <div className={`mt-1 text-xs font-bold ${got ? 'text-navy-900' : 'text-muted'}`}>{m.name}</div>
                    <div className="text-[10px] text-muted">{got ? 'Unlocked' : m.desc}</div>
                  </div>
                )
              })}
            </div>
          </Section>
        </div>
      )}

      <Section title="Available rewards" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {s.rewards.map((r) => {
            const chk = checkRedeem(s.pointsTx, r, me.id, Date.now())
            return (
              <div key={r.id} className="flex gap-3 rounded-2xl border border-sand-100 p-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                  <Gift className="size-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-navy-900">{r.name}</div>
                  <div className="text-xs text-muted">{r.sponsor}</div>
                  <div className="mt-1 text-xs text-muted">{r.conditions}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Tag tone="navy">{r.cost} pts</Tag>
                    <Tag tone={r.stock > 0 ? 'gray' : 'red'}>{r.stock > 0 ? `${r.stock} left` : 'Unavailable'}</Tag>
                    {r.expiresAt && <Tag tone="gray">Expires {fmtDate(r.expiresAt)}</Tag>}
                    {resident && (
                      <button className="btn-teal btn-sm ml-auto" disabled={!chk.ok} onClick={() => setConfirm(r)} title={chk.ok ? '' : chk.reason}>
                        {chk.ok ? 'Redeem' : chk.reason}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        {resident && (
          <Section title="Points history">
            <ul className="divide-y divide-sand-100">
              {myTx.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-navy-900">{t.note}</div>
                    <div className="text-xs text-muted">{fmtDateTime(t.t)} · ref {t.ref}</div>
                  </div>
                  <span className={`font-extrabold tabular-nums ${t.delta > 0 ? 'text-leaf-600' : 'text-danger-700'}`}>
                    {t.delta > 0 ? '+' : ''}
                    {t.delta}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <div className="space-y-5">
          <Section title="Community leaderboard">
            <ol className="space-y-1.5">
              {board.map(({ u, pts }, i) => (
                <li key={u.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${u.id === me.id ? 'bg-teal-50' : ''}`}>
                  <span className="w-5 text-center font-extrabold text-navy-900">{i === 0 ? <Trophy className="size-4 text-amber-500" aria-label="1st" /> : i + 1}</span>
                  <span className="flex-1 text-sm">{u.publicRecognition || u.id === me.id ? u.name.split(' ')[0] + ' ' + u.name.split(' ')[1]?.[0] + '.' : 'Anonymous resident'}{u.id === me.id && ' (you)'}</span>
                  <span className="font-bold tabular-nums text-navy-900">{pts}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-muted">Names appear only for residents who opted in to public recognition (Settings → Profile).</p>
          </Section>
          <Section title="Community goal">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold text-navy-900">Waste removed from drains this quarter</span>
              <span className="tabular-nums">{doneKg} / {goalKg} kg</span>
            </div>
            <Progress value={(doneKg / goalKg) * 100} label="Community waste goal" />
          </Section>
          {can(me, 'rewards:manage') && <RulesAdmin />}
        </div>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Confirm redemption">
        {confirm && (
          <div className="space-y-3">
            <p className="text-sm">
              Redeem <b>{confirm.name}</b> for <b>{confirm.cost} points</b>? Your balance will go from {bal} to {bal - confirm.cost}.
            </p>
            <p className="text-xs text-muted">{confirm.conditions}</p>
            <button className="btn-primary w-full" onClick={() => { act(s.redeem(confirm.id)); setConfirm(null) }}>
              <Award className="size-4" /> Confirm
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function RulesAdmin() {
  const s = useStore()
  const act = useAct()
  return (
    <Section title="Reward rules & stock (admin)">
      <ul className="space-y-2">
        {s.rewardRules.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{r.label}</span>
            <input className="input w-20" type="number" defaultValue={r.points} onBlur={(e) => Number(e.target.value) !== r.points && act(s.updateRewardRule(r.id, { points: Number(e.target.value) }))} aria-label={`${r.label} points`} />
            <input type="checkbox" className="size-5 accent-teal-600" checked={r.active} onChange={(e) => act(s.updateRewardRule(r.id, { active: e.target.checked }))} aria-label={`${r.label} active`} />
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 border-t border-sand-100 pt-3">
        {s.rewards.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{r.name}</span>
            <label className="text-xs text-muted">cost</label>
            <input className="input w-20" type="number" defaultValue={r.cost} onBlur={(e) => Number(e.target.value) !== r.cost && act(s.updateReward(r.id, { cost: Number(e.target.value) }))} aria-label={`${r.name} cost`} />
            <label className="text-xs text-muted">stock</label>
            <input className="input w-20" type="number" defaultValue={r.stock} onBlur={(e) => Number(e.target.value) !== r.stock && act(s.updateReward(r.id, { stock: Number(e.target.value) }))} aria-label={`${r.name} stock`} />
          </div>
        ))}
      </div>
    </Section>
  )
}
