import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertOctagon,
  CircleCheck,
  CircleHelp,
  Eye,
  TriangleAlert,
  WifiOff,
  X,
  Activity,
  FlaskConical,
} from 'lucide-react'
import type { Status } from '../domain/types'

export const STATUS_META: Record<Status, { label: string; cls: string; Icon: typeof CircleCheck }> = {
  normal: { label: 'Normal', cls: 'bg-leaf-100 text-leaf-600 ring-leaf-600/20', Icon: CircleCheck },
  monitor: { label: 'Monitor', cls: 'bg-teal-50 text-teal-700 ring-teal-700/20', Icon: Eye },
  warning: { label: 'Warning', cls: 'bg-amber-100 text-amber-700 ring-amber-700/25', Icon: TriangleAlert },
  critical: { label: 'Critical', cls: 'bg-danger-100 text-danger-700 ring-danger-700/25', Icon: AlertOctagon },
  offline: { label: 'Offline', cls: 'bg-sand-100 text-muted ring-muted/25', Icon: WifiOff },
  inspect: { label: 'Needs inspection', cls: 'bg-navy-50 text-navy-800 ring-navy-800/20', Icon: CircleHelp },
}

export function StatusBadge({ status, label, size = 'sm' }: { status: Status; label?: string; size?: 'sm' | 'md' }) {
  const m = STATUS_META[status]
  return (
    <span className={`chip ring-1 ring-inset ${m.cls} ${size === 'md' ? 'text-[13px] px-3 py-1.5' : ''}`}>
      <m.Icon className={size === 'md' ? 'size-4' : 'size-3.5'} aria-hidden />
      {label ?? m.label}
    </span>
  )
}

export function Tag({ children, tone = 'navy', icon }: { children: ReactNode; tone?: 'navy' | 'teal' | 'amber' | 'red' | 'green' | 'gray'; icon?: ReactNode }) {
  const t = {
    navy: 'bg-navy-50 text-navy-800',
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-danger-100 text-danger-700',
    green: 'bg-leaf-100 text-leaf-600',
    gray: 'bg-sand-100 text-muted',
  }[tone]
  return (
    <span className={`chip ${t}`}>
      {icon}
      {children}
    </span>
  )
}

export function SimTag() {
  return (
    <Tag tone="amber" icon={<FlaskConical className="size-3" aria-hidden />}>
      Simulated
    </Tag>
  )
}

export function LiveTag() {
  return (
    <Tag tone="green" icon={<Activity className="size-3" aria-hidden />}>
      Live sensor
    </Tag>
  )
}

export function MeasuredTag({ kind }: { kind: 'measured' | 'estimate' | 'calculated' }) {
  const m = { measured: ['teal', 'Measured'], estimate: ['gray', 'Estimate'], calculated: ['navy', 'Calculated'] } as const
  return <Tag tone={m[kind][0]}>{m[kind][1]}</Tag>
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="display text-3xl sm:text-4xl text-navy-900">{title}</h1>
        {children && <p className="mt-2 max-w-2xl text-[15px] text-muted">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Section({ title, children, action, className = '' }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold text-navy-900 text-[15px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function StatCard({ label, value, sub, icon, to, tone = 'navy' }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; to?: string; tone?: 'navy' | 'teal' | 'amber' | 'red' | 'green' }) {
  const ring = { navy: 'bg-navy-50 text-navy-800', teal: 'bg-teal-50 text-teal-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-danger-100 text-danger-700', green: 'bg-leaf-100 text-leaf-600' }[tone]
  const body = (
    <div className="card h-full p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className={`grid size-10 place-items-center rounded-xl ${ring}`}>{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight text-navy-900 tabular-nums">{value}</div>
      <div className="text-[13px] font-semibold text-navy-800">{label}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  )
  return to ? (
    <Link to={to} className="block rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-100 bg-white/60 px-6 py-10 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-navy-50 text-navy-700">{icon}</div>
      <div className="font-semibold text-navy-900">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl outline-none sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="display text-2xl text-navy-900">{title}</h2>
          <button className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-sand-100" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; id?: string }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 ${disabled ? 'opacity-50' : ''}`} htmlFor={id}>
      <span className="text-sm text-ink">{label}</span>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-sand-100 ring-1 ring-navy-100 transition peer-checked:bg-teal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-400" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-sand-100 py-2 last:border-0">
      <dt className="text-[13px] text-muted">{k}</dt>
      <dd className="text-right text-sm font-semibold text-navy-900 tabular-nums">{v}</dd>
    </div>
  )
}

export function Timeline({ items, nameOf }: { items: { t: number; by: string; action: string; note?: string }[]; nameOf: (id: string) => string }) {
  return (
    <ol className="relative ml-2 border-l-2 border-navy-100">
      {items.map((it, i) => (
        <li key={i} className="mb-3 ml-4 last:mb-0">
          <span className="absolute -left-[7px] mt-1.5 size-3 rounded-full border-2 border-white bg-teal-500" />
          <div className="text-sm font-semibold text-navy-900">{it.action}</div>
          <div className="text-xs text-muted">
            {new Date(it.t).toLocaleString('en-TT', { dateStyle: 'medium', timeStyle: 'short' })} · {nameOf(it.by)}
          </div>
          {it.note && <div className="mt-0.5 text-[13px] text-ink/80">{it.note}</div>}
        </li>
      ))}
    </ol>
  )
}

export function Progress({ value, tone = 'teal', label }: { value: number; tone?: 'teal' | 'amber' | 'red' | 'navy'; label: string }) {
  const c = { teal: 'bg-teal-500', amber: 'bg-amber-500', red: 'bg-danger-500', navy: 'bg-navy-800' }[tone]
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-sand-100" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full ${c} transition-all duration-700`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-sand-100 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-lg px-3 text-[13px] font-semibold transition ${value === o.value ? 'bg-white text-navy-900 shadow-sm' : 'text-muted hover:text-navy-900'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
