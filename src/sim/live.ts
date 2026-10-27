import { sanitizeTankReading } from '../domain/calc'
import type { SeedState } from '../data/seed'
import { audit, pushReading, raiseLeak, runAlerts, runValves } from './engine'

/**
 * LIVE SENSOR ADAPTER
 * ------------------------------------------------------------------
 * Any board (Arduino UNO R4 WiFi, ESP32, a Raspberry Pi bridge, …) can feed IFRS
 * by making a JSON document available at an HTTPS URL that this page polls
 * (for example a free cloud key–value store, a Google Apps Script web app,
 * Supabase REST, or ThingSpeak's "last entry" feed via a small proxy).
 *
 * Payload contract (one object or an array of objects):
 * {
 *   "device_id": "dev-t-tatil-lvl",      // must match a registered device
 *   "ts": "2026-11-02T14:05:00Z",        // ISO-8601 or epoch ms (optional: defaults to receipt time)
 *   "level_pct": 63.5,                    // EITHER level_pct
 *   "volume_l": 10800,                    //   OR volume_l
 *   "distance_cm": 41.2,                  //   OR raw ultrasonic distance + "tank_height_cm"
 *   "tank_height_cm": 120,
 *   "drain_level_cm": 18.4,               // optional, for a drain-level device
 *   "leak": false,                        // optional leak-probe state
 *   "battery_v": 4.9,                     // optional
 *   "seq": 1043                           // optional monotonically increasing counter (replay protection)
 * }
 *
 * The browser only READS data. Valve commands are never sent from this page – a real
 * controller must enforce its own safety limits locally.
 */

export interface LivePayload {
  device_id: string
  ts?: string | number
  level_pct?: number
  volume_l?: number
  distance_cm?: number
  tank_height_cm?: number
  drain_level_cm?: number
  leak?: boolean
  battery_v?: number
  seq?: number
}

const lastSeq: Record<string, number> = {}

export function parseTs(ts: LivePayload['ts'], now: number): number {
  if (ts === undefined) return now
  const n = typeof ts === 'number' ? ts : Date.parse(ts)
  if (!Number.isFinite(n)) return now
  // Reject timestamps far in the future (clock problems).
  return n > now + 5 * 60_000 ? now : n
}

export function applyLivePayload(s: SeedState, p: LivePayload, now: number): string {
  if (!p || typeof p.device_id !== 'string') return 'Rejected: missing device_id'
  const dev = s.devices.find((d) => d.id === p.device_id)
  if (!dev) return `Rejected: unknown device ${p.device_id}`
  if (!dev.enabled) return `Rejected: device ${dev.id} is disabled`
  if (typeof p.seq === 'number') {
    if (lastSeq[dev.id] !== undefined && p.seq <= lastSeq[dev.id]) return `Ignored: duplicate/replayed seq ${p.seq}`
    lastSeq[dev.id] = p.seq
  }
  const t = parseTs(p.ts, now)
  dev.source = 'live'
  dev.lastSeen = t
  dev.simDisconnected = false
  if (typeof p.battery_v === 'number') dev.battery = Math.max(0, Math.min(100, Math.round(((p.battery_v - 3.3) / (4.2 - 3.3)) * 100)))

  if (dev.kind === 'tank-level') {
    const tank = s.tanks.find((x) => x.id === dev.assetId)
    if (!tank) return 'Rejected: device not assigned to a tank'
    let litres: number | undefined
    if (typeof p.volume_l === 'number') litres = p.volume_l
    else if (typeof p.level_pct === 'number') litres = (p.level_pct / 100) * tank.capacityL
    else if (typeof p.distance_cm === 'number' && typeof p.tank_height_cm === 'number' && p.tank_height_cm > 0)
      litres = ((p.tank_height_cm - p.distance_cm) / p.tank_height_cm) * tank.capacityL
    if (litres === undefined) return 'Rejected: no level measurement in payload'
    const r = sanitizeTankReading(litres, tank.capacityL)
    if (!r.accepted) {
      tank.quality = 'invalid'
      audit(s, dev.id, 'reading.rejected', tank.id, r.reason ?? 'invalid', now)
      return `Rejected reading: ${r.reason}`
    }
    tank.volumeL = r.volumeL
    tank.quality = r.quality
    tank.lastReadingAt = t
    pushReading(tank.history, { t, v: Math.round(r.volumeL) })
    if (p.leak === true) raiseLeak(s, tank, 'leak-sensor', 'Live leak probe reported water.', 'high', now)
  } else if (dev.kind === 'drain-level') {
    const drain = s.drains.find((x) => x.id === dev.assetId)
    if (!drain || typeof p.drain_level_cm !== 'number') return 'Rejected: no drain_level_cm'
    if (p.drain_level_cm < 0 || p.drain_level_cm > drain.rangeCm * 1.1) return 'Rejected: drain level outside sensor range'
    drain.levelCm = p.drain_level_cm
    drain.lastReadingAt = t
    pushReading(drain.history, { t, v: p.drain_level_cm })
  }
  runAlerts(s, now)
  runValves(s, now)
  return `Accepted reading from ${dev.id} at ${new Date(t).toLocaleTimeString()}`
}
