import { useState } from 'react'
import { CircleCheck, CircleX, FileText, HandCoins, Info, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe, useNameOf } from '../store/hooks'
import { can, canReviewRebate } from '../domain/rbac'
import { checkEligibility, estimateRebate, fundingCommitted, REBATE_FLOW, REBATE_LABEL } from '../domain/rebates'
import { fmtDate, fmtL, fmtTTD } from '../domain/calc'
import { Empty, Field, KV, Modal, PageHeader, Progress, Section, Tag, Timeline, Toggle } from '../components/ui'
import { useAct } from '../components/Toasts'
import type { RebateApplication, RebateProgramme, RebateStatus, Tank } from '../domain/types'

const FLOW: RebateStatus[] = ['draft', 'submitted', 'under_review', 'approved', 'credited', 'closed']

export default function Rebates() {
  const me = useMe()
  const s = useStore()
  const prog = s.programmes[0]
  const reviewer = can(me, 'rebate:review')
  return (
    <div>
      <PageHeader eyebrow="Feature 5" title="Water rebates">
        A configurable framework for a <b>future</b> rebate or water-credit programme with a utility, ministry or sponsor.
      </PageHeader>
      <div className="mb-5 flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-100/60 p-4 text-sm text-ink" role="note">
        <Info className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <div>
          <b>Concept only.</b> No official water-rebate scheme exists for IFRS in Trinidad and Tobago. The programme below is a pilot proposal; amounts and rules are placeholders an administrator can change. Nothing here is a payment or an entitlement.
        </div>
      </div>
      {prog && <ProgrammeCard prog={prog} />}
      {me.role === 'resident' && prog && <ResidentView prog={prog} />}
      {reviewer && prog && <ReviewQueue prog={prog} />}
      {can(me, 'rebate:configure') && prog && <ProgrammeAdmin prog={prog} />}
    </div>
  )
}

function ProgrammeCard({ prog }: { prog: RebateProgramme }) {
  const apps = useStore((s) => s.applications)
  const committed = fundingCommitted(apps, prog.id)
  const model = { 'fixed-install': `Fixed rebate of ${fmtTTD(prog.fixedAmountTTD)} for an approved rainwater installation`, equipment: `${prog.equipmentPct}% of approved equipment cost, up to ${fmtTTD(prog.equipmentCapTTD)}`, performance: `${fmtTTD(prog.perKLSavedTTD)} per kL of verified mains-water savings` }[prog.model]
  return (
    <section className="card mb-5 grid gap-4 p-5 md:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <HandCoins className="size-5 text-teal-700" aria-hidden />
          <h2 className="font-bold text-navy-900">{prog.name}</h2>
          <Tag tone={prog.active ? 'green' : 'gray'}>{prog.active ? 'Accepting applications (demo)' : 'Closed'}</Tag>
        </div>
        <p className="mt-2 text-sm text-muted">{model}. Sponsor: {prog.sponsor}. Runs {fmtDate(prog.startDate)} – {fmtDate(prog.endDate)}.</p>
        <div className="mt-3 text-sm font-semibold text-navy-900">Eligibility requirements</div>
        <ul className="mt-1 list-disc pl-5 text-sm text-ink">
          {prog.rules.filter((r) => r.enabled).map((r) => (
            <li key={r.id}>{r.label}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl bg-sand-50 p-4">
        <div className="text-sm font-semibold text-navy-900">Programme funding</div>
        <div className="mt-1 text-2xl font-extrabold tabular-nums text-navy-900">{fmtTTD(committed)}</div>
        <div className="mb-2 text-xs text-muted">committed of {fmtTTD(prog.fundingCapTTD)} cap</div>
        <Progress value={(committed / prog.fundingCapTTD) * 100} label="Funding committed" />
      </div>
    </section>
  )
}

function useElig(prog: RebateProgramme, userId: string) {
  const s = useStore()
  const tanks = s.tanks.filter((t) => t.ownerId === userId) as Tank[]
  const bIds = new Set(tanks.map((t) => t.buildingId))
  const installVerified = s.buildings.filter((b) => bIds.has(b.id)).some((b) => b.installVerified)
  const res = checkEligibility(prog, { tanks, devices: s.devices, buildings: s.buildings, pilotCommunityIds: s.communities.filter((c) => c.pilot).map((c) => c.id), installVerified })
  return { tanks, res, ok: res.every((r) => r.pass) }
}

function ResidentView({ prog }: { prog: RebateProgramme }) {
  const me = useMe()
  const s = useStore()
  const nameOf = useNameOf()
  const act = useAct()
  const { tanks, res, ok } = useElig(prog, me.id)
  const apps = s.applications.filter((a) => a.userId === me.id)
  const active = apps.find((a) => !['rejected', 'closed'].includes(a.status))
  const [form, setForm] = useState(false)
  const est = estimateRebate(prog, { equipmentCostTTD: active?.equipmentCostTTD ?? 0 }, null)
  const usedRain = tanks.reduce((a, t) => a + t.usedL, 0)
  return (
    <>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Section title="Your eligibility (live check)">
          <ul className="space-y-2">
            {res.map((r) => (
              <li key={r.rule.id} className="flex items-start gap-2 text-sm">
                {r.pass ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-leaf-600" aria-label="Met" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-danger-500" aria-label="Not met" />}
                <div>
                  <b className="text-navy-900">{r.rule.label}</b>
                  <div className="text-xs text-muted">{r.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className={`mt-3 rounded-xl p-3 text-sm font-semibold ${ok ? 'bg-leaf-100 text-leaf-600' : 'bg-amber-100 text-amber-700'}`}>{ok ? 'You currently meet every requirement.' : 'Some requirements are not met yet – you can still apply; staff will advise.'}</div>
        </Section>
        <Section title="Estimates (not verified)">
          <dl>
            <KV k="Estimated rebate" v={est.amountTTD ? fmtTTD(est.amountTTD) : '—'} />
            <KV k="Formula" v={<span className="text-xs">{est.formula}</span>} />
            <KV k="Harvested rainwater used (est.)" v={fmtL(usedRain)} />
            <KV k="Verified mains-water savings" v="Not available" />
          </dl>
          <ul className="mt-2 list-disc pl-5 text-xs text-muted">
            {est.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
            <li>Rainwater collected is not the same as mains water saved. Verified savings need utility meter data against a baseline.</li>
          </ul>
        </Section>
      </div>

      <Section title="My applications" action={!active && <button className="btn-teal btn-sm" onClick={() => setForm(true)}>Apply now</button>} className="mb-5">
        {apps.length === 0 ? (
          <Empty icon={<FileText className="size-6" />} title="No applications yet" />
        ) : (
          apps.map((a) => (
            <div key={a.id} className="mb-3 rounded-2xl border border-sand-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <b className="text-navy-900">{a.id.toUpperCase()}</b>
                  <span className="text-xs text-muted"> · started {fmtDate(a.createdAt)}</span>
                </div>
                <Tag tone={a.status === 'approved' || a.status === 'credited' ? 'green' : a.status === 'rejected' ? 'red' : a.status === 'info_required' ? 'amber' : 'teal'}>{REBATE_LABEL[a.status]}</Tag>
              </div>
              <ol className="mt-3 flex gap-1" aria-label="Application progress">
                {FLOW.map((st, i) => {
                  const idx = FLOW.indexOf(a.status === 'info_required' ? 'under_review' : a.status === 'rejected' ? 'under_review' : a.status)
                  return (
                    <li key={st} className="flex-1">
                      <span className={`block h-1.5 rounded-full ${i <= idx ? 'bg-teal-500' : 'bg-sand-100'}`} />
                      <span className={`mt-1 hidden text-[10px] font-semibold sm:block ${i <= idx ? 'text-teal-700' : 'text-muted/60'}`}>{REBATE_LABEL[st]}</span>
                    </li>
                  )
                })}
              </ol>
              {a.status === 'info_required' && (
                <div className="mt-3 rounded-xl bg-amber-100 p-3 text-sm text-amber-700">
                  <b>Action needed:</b> {a.infoRequest}
                  <button className="btn-primary btn-sm mt-2 block" onClick={() => setForm(true)}>Update & resubmit</button>
                </div>
              )}
              {a.status === 'draft' && <button className="btn-primary btn-sm mt-3" onClick={() => setForm(true)}>Continue draft</button>}
              {a.decision && (
                <div className={`mt-3 rounded-xl p-3 text-sm ${a.status === 'rejected' ? 'bg-danger-100 text-danger-700' : 'bg-leaf-100 text-leaf-600'}`}>
                  <b>Decision:</b> {a.status === 'rejected' ? 'Rejected' : `Approved ${fmtTTD(a.decision.amountTTD)}`} – {a.decision.reason} ({fmtDate(a.decision.t)})
                </div>
              )}
              <div className="mt-2 text-xs text-muted">
                Next step: {a.status === 'draft' ? 'submit your application' : a.status === 'submitted' || a.status === 'under_review' ? 'programme staff are reviewing – no action needed' : a.status === 'approved' ? 'credit will be issued by the sponsor' : a.status === 'info_required' ? 'provide the requested information' : 'none'}
              </div>
              <dl className="mt-2 text-xs text-muted">
                Tanks: {a.tankIds.join(', ')} · Account ****{a.accountRefLast4} · Docs: {a.documents.join(', ') || 'none'}
              </dl>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-teal-700">History</summary>
                <div className="mt-2">
                  <Timeline items={a.history} nameOf={nameOf} />
                </div>
              </details>
            </div>
          ))
        )}
      </Section>
      <ApplyForm open={form} onClose={() => setForm(false)} prog={prog} existing={active} tanks={tanks} onSave={(p, submit) => act(s.saveApplication(p, submit))} />
    </>
  )
}

function ApplyForm({ open, onClose, prog, existing, tanks, onSave }: { open: boolean; onClose: () => void; prog: RebateProgramme; existing?: RebateApplication; tanks: Tank[]; onSave: (p: Partial<RebateApplication> & { programmeId: string }, submit: boolean) => boolean }) {
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [f, setF] = useState({ tankIds: existing?.tankIds ?? tanks.map((t) => t.id), propertyRef: existing?.propertyRef ?? '', last4: existing?.accountRefLast4 ?? '', cost: String(existing?.equipmentCostTTD ?? ''), docs: existing?.documents ?? ([] as string[]) })
  const payload = { id: existing?.id, programmeId: prog.id, tankIds: f.tankIds, propertyRef: f.propertyRef, accountRefLast4: f.last4, equipmentCostTTD: Number(f.cost) || 0, documents: f.docs }
  return (
    <Modal open={open} onClose={() => { setStep('form'); onClose() }} title={step === 'form' ? 'Rebate application' : 'Review & confirm'} wide>
      {step === 'form' ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setStep('review') }}>
          <fieldset>
            <legend className="label">Tanks included</legend>
            {tanks.map((t) => (
              <label key={t.id} className="flex min-h-10 items-center gap-2 text-sm">
                <input type="checkbox" className="size-5 accent-teal-600" checked={f.tankIds.includes(t.id)} onChange={(e) => setF({ ...f, tankIds: e.target.checked ? [...f.tankIds, t.id] : f.tankIds.filter((x) => x !== t.id) })} />
                {t.name} ({fmtL(t.capacityL)})
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Property reference" htmlFor="pr" hint="e.g. assessment number (demo)">
              <input id="pr" className="input" value={f.propertyRef} onChange={(e) => setF({ ...f, propertyRef: e.target.value })} />
            </Field>
            <Field label="Utility account – last 4 digits only" htmlFor="l4" hint="We never ask for the full number in this demo">
              <input id="l4" className="input" inputMode="numeric" maxLength={4} pattern="\d{4}" required value={f.last4} onChange={(e) => setF({ ...f, last4: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="Equipment cost (TT$)" htmlFor="ec">
              <input id="ec" className="input" type="number" min={0} value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
            </Field>
            <Field label="Supporting documents" htmlFor="docs" hint="Receipts, installation photos (names only – not uploaded in demo)">
              <input id="docs" className="input" type="file" multiple onChange={(e) => setF({ ...f, docs: Array.from(e.target.files ?? []).map((x) => x.name) })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => onSave(payload, false) && onClose()}>Save draft</button>
            <button className="btn-primary flex-1">Review</button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <dl className="rounded-xl bg-sand-50 p-3">
            <KV k="Programme" v={prog.name} />
            <KV k="Tanks" v={f.tankIds.length} />
            <KV k="Property ref" v={f.propertyRef || '—'} />
            <KV k="Account" v={`****${f.last4}`} />
            <KV k="Equipment cost" v={fmtTTD(Number(f.cost) || 0)} />
            <KV k="Documents" v={f.docs.length} />
          </dl>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" required className="mt-1 size-5 accent-teal-600" id="confirm" />
            I confirm the information is accurate. I understand this is a demonstration and no payment will be made.
          </label>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setStep('form')}>Back</button>
            <button
              className="btn-primary flex-1"
              onClick={() => {
                const c = document.getElementById('confirm') as HTMLInputElement
                if (!c.checked) return c.reportValidity()
                if (onSave(payload, true)) {
                  setStep('form')
                  onClose()
                }
              }}
            >
              Submit application
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ReviewQueue({ prog }: { prog: RebateProgramme }) {
  const me = useMe()
  const s = useStore()
  const nameOf = useNameOf()
  const apps = s.applications.filter((a) => a.programmeId === prog.id)
  return (
    <Section title="Applications for review" className="mb-5">
      <div className="space-y-3">
        {apps.map((a) => (
          <ReviewCard key={a.id} a={a} prog={prog} canDecide={canReviewRebate(me, a.userId)} applicant={nameOf(a.userId)} />
        ))}
      </div>
    </Section>
  )
}

function ReviewCard({ a, prog, canDecide, applicant }: { a: RebateApplication; prog: RebateProgramme; canDecide: boolean; applicant: string }) {
  const s = useStore()
  const act = useAct()
  const nameOf = useNameOf()
  const { res } = useElig(prog, a.userId)
  const est = estimateRebate(prog, a, null)
  const [reason, setReason] = useState('')
  const [amt, setAmt] = useState(String(est.amountTTD))
  const next = a.status === 'draft' || a.status === 'info_required' ? [] : REBATE_FLOW[a.status]
  const building = s.buildings.find((b) => s.tanks.some((t) => a.tankIds.includes(t.id) && t.buildingId === b.id))
  return (
    <article className="rounded-2xl border border-sand-100 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-navy-900">{a.id.toUpperCase()}</b>
        <span className="text-sm text-muted">· {applicant}</span>
        <Tag tone="teal">{REBATE_LABEL[a.status]}</Tag>
        <span className="ml-auto text-xs text-muted">Account ****{a.accountRefLast4}</span>
      </div>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <ul className="space-y-1 text-xs">
          {res.map((r) => (
            <li key={r.rule.id} className="flex gap-1.5">
              {r.pass ? <CircleCheck className="size-3.5 text-leaf-600" aria-label="Met" /> : <CircleX className="size-3.5 text-danger-500" aria-label="Not met" />}
              {r.rule.label} – <span className="text-muted">{r.detail}</span>
            </li>
          ))}
          {building && !building.installVerified && (
            <li>
              <button className="btn-ghost btn-sm mt-1" onClick={() => act(s.updateBuilding(building.id, { installVerified: true }))}>
                <ShieldCheck className="size-4" /> Record installation inspected
              </button>
            </li>
          )}
        </ul>
        <div className="text-xs text-muted">
          <div>Estimate: <b className="text-navy-900">{fmtTTD(est.amountTTD)}</b> ({est.formula})</div>
          <div>Documents: {a.documents.join(', ') || 'none'}</div>
          <details className="mt-1">
            <summary className="cursor-pointer font-semibold text-teal-700">History</summary>
            <Timeline items={a.history} nameOf={nameOf} />
          </details>
        </div>
      </div>
      {!canDecide ? (
        <p className="mt-2 text-xs text-muted">You cannot review your own application.</p>
      ) : (
        next.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-sand-100 pt-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
              <input className="input" placeholder="Reason / note (required to reject or request info)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
              {next.includes('approved') && <input className="input" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} aria-label="Approved amount TT$" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {next.map((to) => (
                <button key={to} className={to === 'rejected' ? 'btn-danger btn-sm' : to === 'info_required' ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'} onClick={() => act(s.rebateTransition(a.id, to, { note: reason || undefined, reason: reason || undefined, amountTTD: Number(amt) }))}>
                  {to === 'under_review' ? 'Start review' : to === 'info_required' ? 'Request information' : to === 'approved' ? `Approve ${fmtTTD(Number(amt) || 0)}` : to === 'credited' ? 'Record credit issued' : REBATE_LABEL[to]}
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </article>
  )
}

function ProgrammeAdmin({ prog }: { prog: RebateProgramme }) {
  const s = useStore()
  const act = useAct()
  const [p, setP] = useState(prog)
  return (
    <Section title="Programme configuration (admin)">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Calculation model" htmlFor="pm">
          <select id="pm" className="input" value={p.model} onChange={(e) => setP({ ...p, model: e.target.value as never })}>
            <option value="fixed-install">Fixed installation rebate</option>
            <option value="equipment">% of equipment cost (capped)</option>
            <option value="performance">Verified water savings</option>
          </select>
        </Field>
        <Field label="Fixed amount (TT$)" htmlFor="pf"><input id="pf" className="input" type="number" value={p.fixedAmountTTD} onChange={(e) => setP({ ...p, fixedAmountTTD: Number(e.target.value) })} /></Field>
        <Field label="Equipment % / cap (TT$)" htmlFor="pe">
          <div className="flex gap-2">
            <input id="pe" className="input" type="number" value={p.equipmentPct} onChange={(e) => setP({ ...p, equipmentPct: Number(e.target.value) })} />
            <input className="input" type="number" value={p.equipmentCapTTD} onChange={(e) => setP({ ...p, equipmentCapTTD: Number(e.target.value) })} aria-label="Equipment cap" />
          </div>
        </Field>
        <Field label="TT$ per kL verified saving" htmlFor="pk"><input id="pk" className="input" type="number" value={p.perKLSavedTTD} onChange={(e) => setP({ ...p, perKLSavedTTD: Number(e.target.value) })} /></Field>
        <Field label="Funding cap (TT$)" htmlFor="pc"><input id="pc" className="input" type="number" value={p.fundingCapTTD} onChange={(e) => setP({ ...p, fundingCapTTD: Number(e.target.value) })} /></Field>
        <Field label="Sponsor" htmlFor="ps"><input id="ps" className="input" value={p.sponsor} onChange={(e) => setP({ ...p, sponsor: e.target.value })} /></Field>
      </div>
      <div className="mt-3 grid gap-1 sm:grid-cols-2">
        {p.rules.map((r, i) => (
          <Toggle key={r.id} id={r.id} label={r.label} checked={r.enabled} onChange={(v) => setP({ ...p, rules: p.rules.map((x, j) => (j === i ? { ...x, enabled: v } : x)) })} />
        ))}
        <Toggle id="pact" label="Programme accepting applications" checked={p.active} onChange={(v) => setP({ ...p, active: v })} />
      </div>
      <button className="btn-primary mt-3" onClick={() => act(s.updateProgramme(prog.id, p))}>Save programme</button>
    </Section>
  )
}
