import type { Device, Drain, Reading, ReadingQuality, Status, Tank } from './types'

export const DEFAULT_STALE_SEC = 15 * 60

/** Percentage full = (current volume / capacity) × 100 */
export function percentFull(volumeL: number, capacityL: number): number {
  if (!(capacityL > 0)) return 0
  return (volumeL / capacityL) * 100
}

/** Available capacity = capacity − current volume (never negative). */
export function availableL(volumeL: number, capacityL: number): number {
  return Math.max(0, capacityL - volumeL)
}

export interface SanitizedReading {
  accepted: boolean
  volumeL: number
  quality: ReadingQuality
  reason?: string
}

/**
 * Validate a raw tank-volume reading.
 * - Non-numeric or negative readings are rejected (previous value kept).
 * - Readings above capacity (beyond a small sensor tolerance) are accepted
 *   but flagged as an overflow / sensor inconsistency and clamped for display.
 */
export function sanitizeTankReading(rawL: number, capacityL: number, tolerancePct = 2): SanitizedReading {
  if (typeof rawL !== 'number' || !Number.isFinite(rawL)) {
    return { accepted: false, volumeL: NaN, quality: 'invalid', reason: 'Reading is not a number' }
  }
  if (rawL < 0) {
    return { accepted: false, volumeL: NaN, quality: 'invalid', reason: 'Negative volume is physically impossible' }
  }
  const limit = capacityL * (1 + tolerancePct / 100)
  if (rawL > limit) {
    return {
      accepted: true,
      volumeL: capacityL,
      quality: 'overflow',
      reason: `Reading ${Math.round(rawL)} L exceeds capacity ${capacityL} L – overflow or sensor fault`,
    }
  }
  return { accepted: true, volumeL: Math.min(rawL, capacityL), quality: 'ok' }
}

export type Freshness = 'fresh' | 'stale' | 'offline'

/** fresh: within staleAfter; stale: up to 4× staleAfter; offline: beyond that. */
export function freshness(lastAt: number, now: number, staleAfterSec = DEFAULT_STALE_SEC): Freshness {
  const age = (now - lastAt) / 1000
  if (age <= staleAfterSec) return 'fresh'
  if (age <= staleAfterSec * 4) return 'stale'
  return 'offline'
}

export function deviceHealth(d: Device | undefined, now: number, staleAfterSec = DEFAULT_STALE_SEC): 'online' | 'stale' | 'offline' | 'fault' | 'awaiting' | 'disabled' {
  if (!d) return 'offline'
  if (!d.enabled) return 'disabled'
  if (d.source === 'awaiting-hardware') return 'awaiting'
  if (d.fault) return 'fault'
  const f = freshness(d.lastSeen, now, staleAfterSec)
  return f === 'fresh' ? 'online' : f
}

export function tankStatus(tank: Tank, device: Device | undefined, now: number, staleAfterSec = DEFAULT_STALE_SEC): Status {
  const h = deviceHealth(device, now, staleAfterSec)
  if (h === 'offline' || h === 'disabled' || h === 'awaiting') return 'offline'
  if (h === 'fault' || tank.quality === 'overflow' || tank.quality === 'invalid') return 'inspect'
  if (h === 'stale') return 'inspect'
  const pct = percentFull(tank.volumeL, tank.capacityL)
  if (pct >= 98) return 'critical'
  if (pct >= tank.highThresholdPct) return 'warning'
  if (pct >= tank.highThresholdPct - 10) return 'monitor'
  if (pct <= tank.lowThresholdPct) return 'monitor'
  return 'normal'
}

/**
 * Simulation time acceleration: simulated minutes per real minute. Simulated devices report
 * every few real seconds but each report represents several minutes, so rates computed from
 * their timestamps are scaled back to simulated time. Real (live) devices use 1.
 */
let SIM_ACCEL = 1
export function setSimAccel(a: number) {
  SIM_ACCEL = a > 0 ? a : 1
}
export const accelFor = (d: Device | undefined) => (d && d.source === 'simulated' ? SIM_ACCEL : 1)

/** Rate of rise in cm/min over the most recent window (uses first and last point in window). */
export function rateOfRise(history: Reading[], windowMin = 15, accel = 1): number | null {
  if (history.length < 2) return null
  const last = history[history.length - 1]
  const cutoff = last.t - (windowMin * 60_000) / accel
  let first = history[history.length - 2]
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].t < cutoff) break
    first = history[i]
  }
  const dtMin = ((last.t - first.t) / 60_000) * accel
  if (dtMin <= 0) return null
  return (last.v - first.v) / dtMin
}

export function drainStatus(drain: Drain, device: Device | undefined, now: number, staleAfterSec = DEFAULT_STALE_SEC): Status {
  const h = deviceHealth(device, now, staleAfterSec)
  if (h === 'offline' || h === 'disabled' || h === 'awaiting') return 'offline'
  if (h === 'fault' || h === 'stale') return 'inspect'
  if (drain.levelCm >= drain.criticalCm) return 'critical'
  const rise = rateOfRise(drain.history, 15, accelFor(device))
  if (drain.levelCm >= drain.elevatedCm) return 'warning'
  if (rise !== null && rise > drain.maxRiseCmPerMin) return 'warning'
  if (drain.levelCm >= drain.elevatedCm * 0.75) return 'monitor'
  return 'normal'
}

export function basketOverdue(drain: Drain, now: number): boolean {
  return now - drain.basketLastCleaned > drain.basketCleanIntervalDays * 86_400_000
}

/**
 * Suspected blockage heuristic. Always reported as *suspected* — only an inspection can confirm.
 * Signals: high water with little or no rain, unusually fast rise, or an overdue basket while elevated.
 */
export function blockageSignals(drain: Drain, rainLevel: number, now: number, accel = SIM_ACCEL): string[] {
  const reasons: string[] = []
  const rise = rateOfRise(drain.history, 15, accel)
  if (drain.levelCm >= drain.elevatedCm && rainLevel === 0) {
    reasons.push('Water level is elevated while no rain is falling')
  }
  if (rise !== null && rise > drain.maxRiseCmPerMin * 1.5 && rainLevel <= 1) {
    reasons.push(`Rising ${rise.toFixed(1)} cm/min with light or no rain`)
  }
  if (basketOverdue(drain, now) && drain.levelCm >= drain.elevatedCm * 0.75) {
    reasons.push('Drain basket cleaning is overdue and level is above normal')
  }
  return reasons
}

export const fmtL = (l: number) =>
  l >= 10_000 ? `${(l / 1000).toFixed(1)} kL` : `${Math.round(l).toLocaleString()} L`

export const fmtPct = (p: number) => `${Math.round(p)}%`

export function timeAgo(t: number, now = Date.now()): string {
  const s = Math.round((now - t) / 1000)
  if (s < 0) return 'just now'
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

export const fmtDateTime = (t: number) =>
  new Date(t).toLocaleString('en-TT', { dateStyle: 'medium', timeStyle: 'short' })

export const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-TT', { dateStyle: 'medium' })

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('en-TT', { hour: '2-digit', minute: '2-digit' })

export const fmtTTD = (n: number) => `TT$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
