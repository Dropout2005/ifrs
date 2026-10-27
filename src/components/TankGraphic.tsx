import { useId } from 'react'

/** Animated tank that fills to `pct`. Threshold lines are labelled; colour is never the only signal. */
export function TankGraphic({
  pct,
  highPct,
  minPct,
  releasing,
  offline,
  size = 'md',
  label,
}: {
  pct: number
  highPct?: number
  minPct?: number
  releasing?: boolean
  offline?: boolean
  size?: 'sm' | 'md' | 'lg'
  label: string
}) {
  const id = useId().replace(/:/g, '')
  const W = 120
  const H = 160
  const top = 14
  const bottom = H - 8
  const inner = bottom - top
  const p = Math.max(0, Math.min(100, pct))
  const y = bottom - (inner * p) / 100
  const fill = offline ? '#9aa5b1' : p >= (highPct ?? 90) ? '#e39a1b' : '#1fa597'
  const dims = { sm: 'w-16', md: 'w-28', lg: 'w-40' }[size]
  const lineY = (v: number) => bottom - (inner * v) / 100
  const wave = (yy: number, amp: number) => {
    let d = `M0 ${yy}`
    for (let x = 0; x <= W * 2; x += 30) d += ` q 7.5 ${-amp} 15 0 t 15 0`
    return d + ` V ${H} H 0 Z`
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`${dims} shrink-0`} role="img" aria-label={`${label}: ${Math.round(p)}% full${offline ? ', sensor offline' : ''}`}>
      <defs>
        <clipPath id={`clip-${id}`}>
          <rect x="10" y={top} width={W - 20} height={inner} rx="14" />
        </clipPath>
        <linearGradient id={`g-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={fill} stopOpacity="0.95" />
          <stop offset="1" stopColor={offline ? '#7b8794' : '#0b2545'} stopOpacity="0.95" />
        </linearGradient>
      </defs>
      {/* lid */}
      <rect x="34" y="4" width="52" height="10" rx="4" fill="#13315c" />
      <rect x="10" y={top} width={W - 20} height={inner} rx="14" fill="#eef3fa" stroke="#13315c" strokeWidth="3" />
      <g clipPath={`url(#clip-${id})`}>
        <g style={{ transform: `translateY(${y - top}px)`, transition: 'transform 900ms cubic-bezier(.2,.8,.2,1)' }}>
          <path d={wave(top, 5)} fill={`url(#g-${id})`} className="wave-move" opacity="0.9" />
          <path d={wave(top + 3, 4)} fill={fill} className="wave-move-slow" opacity="0.45" />
        </g>
        {/* ribs */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="10" x2={W - 10} y1={top + inner * f} y2={top + inner * f} stroke="#13315c" strokeOpacity="0.08" strokeWidth="2" />
        ))}
      </g>
      {highPct !== undefined && (
        <g>
          <line x1="12" x2={W - 12} y1={lineY(highPct)} y2={lineY(highPct)} stroke="#a0111c" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={W - 14} y={lineY(highPct) - 3} fontSize="9" textAnchor="end" fill="#a0111c" fontWeight="700">
            HIGH
          </text>
        </g>
      )}
      {minPct !== undefined && minPct > 0 && (
        <g>
          <line x1="12" x2={W - 12} y1={lineY(minPct)} y2={lineY(minPct)} stroke="#0b2545" strokeWidth="1.5" strokeDasharray="2 3" />
          <text x={W - 14} y={lineY(minPct) - 3} fontSize="9" textAnchor="end" fill="#0b2545" fontWeight="700">
            KEEP
          </text>
        </g>
      )}
      {/* outlet */}
      <rect x={W - 12} y={bottom - 20} width="12" height="8" rx="2" fill="#13315c" />
      {releasing &&
        [0, 1, 2].map((i) => (
          <circle key={i} cx={W - 3} cy={bottom - 8} r="2.2" fill="#2ec4b6" style={{ animation: `rainfall 1.2s ${i * 0.4}s linear infinite` }} />
        ))}
      <text x={W / 2} y={top + inner / 2 + 6} textAnchor="middle" fontSize="20" fontWeight="800" fill={p > 50 ? '#fff' : '#0b2545'} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {offline ? '—' : `${Math.round(p)}%`}
      </text>
    </svg>
  )
}
