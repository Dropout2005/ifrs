import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Reading } from '../domain/types'

const tickTime = (t: number) => {
  const d = new Date(t)
  return d.toLocaleTimeString('en-TT', { hour: '2-digit', minute: '2-digit' })
}
const tickDay = (t: number) => new Date(t).toLocaleDateString('en-TT', { weekday: 'short', hour: '2-digit' })

export function LevelChart({
  data,
  unit,
  refs = [],
  color = '#1fa597',
  max,
  height = 220,
  label,
}: {
  data: Reading[]
  unit: string
  refs?: { y: number; label: string; color: string }[]
  color?: string
  max?: number
  height?: number
  label: string
}) {
  const span = data.length > 1 ? data[data.length - 1].t - data[0].t : 0
  const fmt = span > 20 * 3_600_000 ? tickDay : tickTime
  const gid = `grad-${label.replace(/\W/g, '')}`
  return (
    <figure aria-label={label} className="w-full">
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity={0.35} />
                <stop offset="1" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e3e9ef" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmt} tick={{ fontSize: 11, fill: '#52606d' }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11, fill: '#52606d' }} domain={[0, max ?? 'auto']} width={52} tickFormatter={(v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))} />
            <Tooltip
              labelFormatter={(t) => new Date(Number(t)).toLocaleString('en-TT', { dateStyle: 'medium', timeStyle: 'short' })}
              formatter={(v) => [`${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`, 'Reading']}
              contentStyle={{ borderRadius: 12, border: '1px solid #dfe8f5', fontSize: 12 }}
            />
            {refs.map((r) => (
              <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="5 4" label={{ value: r.label, position: 'insideTopRight', fontSize: 10, fill: r.color, fontWeight: 700 }} />
            ))}
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.2} fill={`url(#${gid})`} isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 text-[11px] text-muted">
        {label} · unit: {unit} · {data.length} readings
      </figcaption>
    </figure>
  )
}

export function Sparkline({ data, color = '#1fa597' }: { data: Reading[]; color?: string }) {
  const pts = data.slice(-40)
  if (pts.length < 2) return null
  const min = Math.min(...pts.map((p) => p.v))
  const max = Math.max(...pts.map((p) => p.v))
  const r = max - min || 1
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * 100} ${28 - ((p.v - min) / r) * 26}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
