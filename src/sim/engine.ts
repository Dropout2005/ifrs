import { deviceHealth, percentFull, sanitizeTankReading } from '../domain/calc'
import { LEAK_TICKS_REQUIRED, isLeakOpen, nextSuspicionCount, severityFor, unexplainedLossL } from '../domain/leak'
import { evaluateRelease } from '../domain/releasePolicy'
import type { AppNotification, Reading, Tank } from '../domain/types'
import type { SeedState } from '../data/seed'

/**
 * SIMULATION SERVICE (demo only).
 * Mutates a draft of the app state for one tick. Produces clearly-labelled simulated readings,
 * runs leak detection and the illustrative release policy exactly as a real gateway would
 * on incoming data. Devices whose source is 'live' are skipped – their data comes from the
 * live adapter instead.
 */

export const RAIN_MM_PER_H = [0, 5, 20, 50] as const
export const RAIN_LABEL = ['No rain', 'Light rain', 'Heavy rain', 'Severe storm'] as const
const RAIN_DRAIN_CM = [0, 12, 38, 72]
const RUNOFF_COEFF = 0.85
export const HISTORY_CAP = 400

let idSeq = 0
export const uid = (p: string) => `${p}-${Date.now().toString(36)}${(idSeq++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`

export function pushReading(hist: Reading[], r: Reading) {
  hist.push(r)
  if (hist.length > HISTORY_CAP) hist.splice(0, hist.length - HISTORY_CAP)
}

export function notify(s: SeedState, n: Omit<AppNotification, 'id' | 'readBy' | 'simulatedChannels'> & { simulatedChannels?: string[] }) {
  s.notifications.unshift({ id: uid('n'), readBy: [], simulatedChannels: n.simulatedChannels ?? ['in-app'], ...n })
  if (s.notifications.length > 150) s.notifications.length = 150
}

export function audit(s: SeedState, actorId: string, action: string, target: string, detail: string, now = Date.now()) {
  s.audit.unshift({ id: uid('a'), t: now, actorId, action, target, detail })
  if (s.audit.length > 400) s.audit.length = 400
}

export function raiseLeak(s: SeedState, tank: Tank, method: 'leak-sensor' | 'level-discrepancy', evidence: string, severity: 'low' | 'medium' | 'high', now: number) {
  if (s.leaks.some((l) => l.tankId === tank.id && isLeakOpen(l.status))) return
  const id = uid('lk')
  s.leaks.unshift({ id, tankId: tank.id, method, severity, status: 'suspected', detectedAt: now, evidence, timeline: [{ t: now, by: 'leak-detector', action: 'Suspected leak raised', note: method === 'leak-sensor' ? 'Leak probe activated' : 'Unexplained level drop rule' }] })
  notify(s, { t: now, kind: 'leak', severity: severity === 'high' ? 'critical' : 'warning', title: `Possible leak: ${tank.name}`, body: evidence, link: '/leaks', userIds: [tank.ownerId], roles: ['maintenance', 'admin'], simulatedChannels: ['in-app', 'sms (simulated)'] })
  audit(s, 'leak-detector', 'leak.suspected', tank.id, evidence, now)
}

export function simulateTick(s: SeedState, now: number, rand: () => number = Math.random) {
  const dtMin = s.sim.minutesPerTick
  const rainMm = RAIN_MM_PER_H[s.sim.rain]
  const releasesIntoDrain: Record<string, number> = {}

  // ---- Tanks -------------------------------------------------------------
  for (const tank of s.tanks) {
    const dev = s.devices.find((d) => d.id === tank.levelDeviceId)
    if (!dev || !dev.enabled || dev.source !== 'simulated' || dev.simDisconnected) continue
    const valve = tank.valveId ? s.valves.find((v) => v.id === tank.valveId) : undefined

    const collected = (tank.catchmentM2 * rainMm * RUNOFF_COEFF * dtMin) / 60
    const used = tank.usageLpm * dtMin * (0.6 + rand() * 0.8)
    let released = 0
    if (valve && (valve.state === 'open' || valve.state === 'closing' || valve.state === 'opening')) {
      const factor = valve.state === 'open' ? 1 : 0.5
      const room = Math.max(0, tank.volumeL - valve.config.minRetainedL)
      released = Math.min(valve.config.maxReleaseLpm * dtMin * factor, room)
      valve.currentReleaseLpm = released / dtMin
      if (valve.drainId) releasesIntoDrain[valve.drainId] = (releasesIntoDrain[valve.drainId] ?? 0) + valve.currentReleaseLpm
    } else if (valve) {
      valve.currentReleaseLpm = 0
    }
    const leakL = tank.simLeakLpm * dtMin
    const noise = (rand() - 0.5) * tank.capacityL * 0.001
    const raw = tank.volumeL + collected - used - released - leakL + noise
    const res = sanitizeTankReading(Math.max(0, raw), tank.capacityL)
    if (!res.accepted) continue
    // Overflow while raining is a real event (spilling); not a sensor fault.
    const spilled = raw > tank.capacityL
    const measuredDelta = res.volumeL - tank.volumeL
    tank.quality = spilled ? 'ok' : res.quality
    tank.volumeL = res.volumeL
    tank.collectedL += collected
    tank.usedL += used
    tank.releasedL += released
    tank.lastReadingAt = now
    dev.lastSeen = now
    pushReading(tank.history, { t: now, v: Math.round(tank.volumeL) })

    // Leak detection – skip when tank is at capacity (spill makes the balance unknowable).
    if (!spilled && tank.volumeL > 0) {
      const lost = unexplainedLossL({ measuredDeltaL: measuredDelta, collectedL: collected, usedL: used, releasedL: released, toleranceL: tank.capacityL * 0.0025 + 3 })
      tank.leakSuspicionCount = nextSuspicionCount(tank.leakSuspicionCount, lost)
      if (tank.leakSuspicionCount >= LEAK_TICKS_REQUIRED) {
        const lpm = lost / dtMin
        raiseLeak(s, tank, 'level-discrepancy', `Level dropped ≈${lpm.toFixed(1)} L/min more than recorded usage and release for ${tank.leakSuspicionCount} consecutive intervals.`, severityFor(lpm), now)
      }
    }
    if (tank.leakDeviceId) {
      const probe = s.devices.find((d) => d.id === tank.leakDeviceId)
      if (probe && probe.enabled && !probe.simDisconnected) {
        probe.lastSeen = now
        if (probe.wet) raiseLeak(s, tank, 'leak-sensor', 'Leak probe at the tank base is detecting water.', 'high', now)
      }
    }
  }

  // ---- Drains ------------------------------------------------------------
  for (const drain of s.drains) {
    const dev = s.devices.find((d) => d.id === drain.deviceId)
    if (!dev || !dev.enabled || dev.source !== 'simulated' || dev.simDisconnected) continue
    const fromTanks = (releasesIntoDrain[drain.id] ?? 0) * 0.05
    const target = drain.simBaseCm + RAIN_DRAIN_CM[s.sim.rain] + drain.simBlockageCm + fromTanks
    const next = drain.levelCm + (target - drain.levelCm) * 0.35 + (rand() - 0.5) * 1.6
    drain.levelCm = Math.max(0, Math.min(drain.rangeCm, next))
    drain.lastReadingAt = now
    dev.lastSeen = now
    pushReading(drain.history, { t: now, v: Math.round(drain.levelCm * 10) / 10 })
  }

  runAlerts(s, now)
  runValves(s, now)
}

/** Threshold-crossing alerts (fires once per crossing). */
export function runAlerts(s: SeedState, now: number) {
  for (const tank of s.tanks) {
    const pct = percentFull(tank.volumeL, tank.capacityL)
    const next = pct >= 98 ? 'critical' : pct >= tank.highThresholdPct ? 'high' : 'none'
    const order = { none: 0, high: 1, critical: 2 }
    if (order[next] > order[tank.alertState ?? 'none']) {
      notify(s, { t: now, kind: 'tank', severity: next === 'critical' ? 'critical' : 'warning', title: `${tank.name} is ${Math.round(pct)}% full`, body: next === 'critical' ? 'Tank is at capacity and may overflow.' : `Above the ${tank.highThresholdPct}% high-level threshold.`, link: `/tanks/${tank.id}`, userIds: [tank.ownerId], roles: ['admin'] })
    }
    if (next === 'none' && pct < tank.highThresholdPct - 5) tank.alertState = 'none'
    else if (order[next] > order[tank.alertState ?? 'none']) tank.alertState = next
  }
  for (const d of s.drains) {
    const next = d.levelCm >= d.criticalCm ? 'critical' : d.levelCm >= d.elevatedCm ? 'elevated' : 'none'
    const order = { none: 0, elevated: 1, critical: 2 }
    if (order[next] > order[d.alertState ?? 'none']) {
      notify(s, { t: now, kind: 'drain', severity: next === 'critical' ? 'critical' : 'warning', title: `${next === 'critical' ? 'Critical' : 'Elevated'} drain level: ${d.name}`, body: `${d.levelCm.toFixed(0)} cm (elevated ${d.elevatedCm} cm, critical ${d.criticalCm} cm).`, link: `/drains/${d.id}`, roles: ['maintenance', 'admin'], simulatedChannels: ['in-app', 'email (simulated)'] })
      d.alertState = next
    } else if (next === 'none' && d.levelCm < d.elevatedCm - 8) d.alertState = 'none'
    else if (next === 'elevated' && d.alertState === 'critical' && d.levelCm < d.criticalCm - 8) d.alertState = 'elevated'
  }
  for (const dev of s.devices) {
    const h = deviceHealth(dev, now)
    if ((h === 'offline' || h === 'fault') && !dev.offlineNotified) {
      dev.offlineNotified = true
      const tank = s.tanks.find((t) => t.id === dev.assetId)
      notify(s, { t: now, kind: 'device', severity: 'warning', title: `Device ${h}: ${dev.id}`, body: `${dev.model} has ${h === 'fault' ? 'reported a fault' : 'stopped reporting'}. Readings are marked unavailable.`, link: '/settings/devices', userIds: tank ? [tank.ownerId] : undefined, roles: ['maintenance', 'admin'] })
    } else if (h === 'online' && dev.offlineNotified) {
      dev.offlineNotified = false
    }
  }
}

export function runValves(s: SeedState, now: number) {
  for (const valve of s.valves) {
    const tank = s.tanks.find((t) => t.id === valve.tankId)
    if (!tank) continue
    const drain = s.drains.find((d) => d.id === valve.drainId)
    const vdev = s.devices.find((d) => d.id === valve.deviceId)
    if (vdev && vdev.source === 'simulated') vdev.lastSeen = now

    if (valve.simFault && valve.state !== 'fault') {
      valve.state = 'fault'
      valve.stateSince = now
      valve.currentReleaseLpm = 0
      valve.log.unshift({ id: uid('vl'), t: now, action: 'fault', mode: valve.mode, by: 'controller', reason: 'Valve controller reported a fault – release disabled, hardware safe state' })
      notify(s, { t: now, kind: 'device', severity: 'critical', title: `Valve fault: ${tank.name}`, body: 'Release disabled. Inspection required.', link: `/tanks/${tank.id}`, userIds: [tank.ownerId], roles: ['maintenance', 'admin'] })
      audit(s, 'controller', 'valve.fault', valve.id, 'Fault reported', now)
    } else if (!valve.simFault && valve.state === 'fault') {
      valve.state = 'closed'
      valve.stateSince = now
      valve.log.unshift({ id: uid('vl'), t: now, action: 'close', mode: valve.mode, by: 'controller', reason: 'Fault cleared – valve reset to closed' })
    }

    // Complete transitional states.
    if (valve.state === 'opening' && now - valve.stateSince >= 1) {
      valve.state = 'open'
      valve.stateSince = now
    } else if (valve.state === 'closing' && now - valve.stateSince >= 1) {
      valve.state = 'closed'
      valve.stateSince = now
      valve.currentReleaseLpm = 0
    }

    const decision = evaluateRelease({
      tank,
      valve,
      tankDevice: s.devices.find((d) => d.id === tank.levelDeviceId),
      drain,
      drainDevice: drain ? s.devices.find((d) => d.id === drain.deviceId) : undefined,
      now,
      emergencyStop: s.sim.emergencyStop,
    })
    valve.lastDecision = { t: now, action: decision.action, summary: decision.summary, rules: decision.rules }
    if (valve.state === 'fault') continue
    if (decision.action === 'open' && (valve.state === 'closed' || valve.state === 'closing')) {
      valve.state = 'opening'
      valve.stateSince = now
      valve.lastOperationAt = now
      valve.lastOperationBy = 'auto-policy'
      valve.log.unshift({ id: uid('vl'), t: now, action: 'open', mode: 'auto', by: 'auto-policy', reason: decision.summary })
      audit(s, 'auto-policy', 'valve.open', valve.id, decision.summary, now)
    } else if (decision.action === 'close' && (valve.state === 'open' || valve.state === 'opening')) {
      valve.state = 'closing'
      valve.stateSince = now
      valve.lastOperationAt = now
      valve.lastOperationBy = valve.mode === 'manual' ? 'safety-interlock' : 'auto-policy'
      valve.log.unshift({ id: uid('vl'), t: now, action: 'close', mode: valve.mode, by: valve.lastOperationBy, reason: decision.summary })
      audit(s, valve.lastOperationBy, 'valve.close', valve.id, decision.summary, now)
    }
    if (valve.log.length > 60) valve.log.length = 60
  }
}
