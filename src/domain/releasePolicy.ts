import { accelFor, deviceHealth, freshness, rateOfRise } from './calc'
import type { Device, Drain, RuleResult, Tank, Valve } from './types'

/**
 * ILLUSTRATIVE DEMONSTRATION POLICY – not validated for real infrastructure.
 * In a real installation the local hardware controller must enforce these limits
 * independently; the web app may only *request* actions.
 */

export interface ReleaseContext {
  tank: Tank
  valve: Valve
  tankDevice?: Device
  drain?: Drain
  drainDevice?: Device
  now: number
  emergencyStop: boolean
}

export interface ReleaseDecision {
  action: 'open' | 'close' | 'hold'
  /** Releasing is permitted by all safety interlocks (independent of whether there is a reason to release). */
  safeToRelease: boolean
  rules: RuleResult[]
  summary: string
}

/** Stop margin above minimum retained volume (fraction of capacity) to avoid hunting. */
export const STOP_MARGIN_FRACTION = 0.01

export function inWindow(now: number, start: string, end: string): boolean {
  const d = new Date(now)
  const mins = d.getHours() * 60 + d.getMinutes()
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const s = sh * 60 + sm
  const e = eh * 60 + em
  if (s === e) return true // 24h window
  return s < e ? mins >= s && mins < e : mins >= s || mins < e // overnight windows
}

/** Safety interlocks – all must pass before any release (automatic OR manual). */
export function safetyInterlocks(ctx: ReleaseContext): RuleResult[] {
  const { tank, valve, tankDevice, drain, drainDevice, now, emergencyStop } = ctx
  const c = valve.config
  const rules: RuleResult[] = []

  rules.push({
    id: 'estop',
    label: 'Emergency stop not active',
    pass: !emergencyStop,
    detail: emergencyStop ? 'System-wide emergency stop is engaged – all release disabled' : 'Emergency stop is clear',
  })

  const tFresh = freshness(tank.lastReadingAt, now, c.staleAfterSec)
  const tHealth = deviceHealth(tankDevice, now, c.staleAfterSec)
  rules.push({
    id: 'tank-reading',
    label: 'Tank reading is recent and valid',
    pass: tFresh === 'fresh' && tHealth === 'online' && tank.quality === 'ok',
    detail:
      tHealth !== 'online'
        ? `Tank level sensor is ${tHealth}`
        : tFresh !== 'fresh'
          ? `Last tank reading is ${tFresh}`
          : tank.quality !== 'ok'
            ? `Reading flagged: ${tank.quality}`
            : 'Tank level sensor online, reading current',
  })

  rules.push({
    id: 'valve-ok',
    label: 'Valve operational',
    pass: valve.state !== 'fault' && !valve.simFault,
    detail: valve.state === 'fault' || valve.simFault ? 'Valve reports a fault' : 'Valve reports no faults',
  })

  if (drain) {
    const dHealth = deviceHealth(drainDevice, now, c.staleAfterSec)
    const dFresh = freshness(drain.lastReadingAt, now, c.staleAfterSec)
    const drainOk = dHealth === 'online' && dFresh === 'fresh'
    rules.push({
      id: 'drain-reading',
      label: 'Downstream drain reading is recent',
      pass: drainOk,
      detail: drainOk ? `${drain.name} sensor online` : `${drain.name} sensor is ${dHealth === 'online' ? dFresh : dHealth} – cannot confirm downstream capacity`,
    })
    rules.push({
      id: 'drain-level',
      label: `Downstream drain below ${c.drainSuspendCm} cm`,
      pass: drainOk && drain.levelCm < c.drainSuspendCm,
      detail: drainOk
        ? `${drain.name} at ${drain.levelCm.toFixed(0)} cm (suspend at ${c.drainSuspendCm} cm)`
        : 'Unknown drain level – treated as unsafe',
    })
    const rise = rateOfRise(drain.history, 15, accelFor(drainDevice))
    rules.push({
      id: 'drain-rise',
      label: 'Drain not rising rapidly',
      pass: drainOk && (rise === null || rise <= c.maxDrainRiseCmPerMin),
      detail:
        rise === null
          ? 'Not enough readings to compute rate of rise'
          : `Rising ${rise.toFixed(2)} cm/min (limit ${c.maxDrainRiseCmPerMin} cm/min)`,
    })
  } else {
    rules.push({
      id: 'drain-reading',
      label: 'Downstream drain configured',
      pass: false,
      detail: 'No downstream drain is linked – release not permitted without downstream monitoring',
    })
  }

  const minStop = c.minRetainedL + tank.capacityL * STOP_MARGIN_FRACTION
  rules.push({
    id: 'min-retained',
    label: 'Above minimum retained volume',
    pass: tank.volumeL > minStop,
    detail: `${Math.round(tank.volumeL)} L stored; must keep ${Math.round(c.minRetainedL)} L for reuse`,
  })

  return rules
}

/**
 * Automatic-mode decision. Opens only when every interlock passes, auto mode is enabled,
 * time is inside the permitted window and the tank has reached the high trigger.
 * Once open, keeps releasing until volume approaches the minimum retained level.
 */
export function evaluateRelease(ctx: ReleaseContext): ReleaseDecision {
  const { tank, valve, now } = ctx
  const c = valve.config
  const interlocks = safetyInterlocks(ctx)
  const safe = interlocks.every((r) => r.pass)
  const rules: RuleResult[] = [...interlocks]

  rules.push({
    id: 'auto',
    label: 'Automatic release enabled',
    pass: c.autoEnabled && valve.mode === 'auto',
    detail: valve.mode === 'manual' ? 'Valve is in manual mode' : c.autoEnabled ? 'Auto mode on' : 'Automatic release disabled by owner',
  })

  const win = inWindow(now, c.windowStart, c.windowEnd)
  rules.push({
    id: 'window',
    label: 'Inside permitted operating window',
    pass: win,
    detail: `Window ${c.windowStart}–${c.windowEnd}`,
  })

  const isReleasing = valve.state === 'open' || valve.state === 'opening'
  const aboveTrigger = tank.volumeL >= c.highTriggerL
  rules.push({
    id: 'trigger',
    label: isReleasing ? 'Release in progress (until minimum retained)' : 'Tank reached high-level trigger',
    pass: isReleasing || aboveTrigger,
    detail: `${Math.round(tank.volumeL)} L vs trigger ${Math.round(c.highTriggerL)} L`,
  })

  const autoOk = c.autoEnabled && valve.mode === 'auto'
  const allPass = rules.every((r) => r.pass)

  let action: ReleaseDecision['action']
  let summary: string
  if (valve.mode === 'manual') {
    // In manual mode the policy never opens, but it still forces closure when unsafe.
    action = isReleasing && !safe ? 'close' : 'hold'
    summary = action === 'close' ? `Safety interlock closed the valve: ${firstFail(interlocks)}` : 'Manual mode – no automatic action'
  } else if (allPass) {
    action = isReleasing ? 'hold' : 'open'
    summary = isReleasing
      ? `Releasing at up to ${c.maxReleaseLpm} L/min until ${Math.round(c.minRetainedL)} L remain`
      : `Opening: tank above trigger and all safety conditions met`
  } else if (isReleasing) {
    action = 'close'
    summary = !safe ? `Stopping release: ${firstFail(interlocks)}` : `Stopping release: ${firstFail(rules)}`
  } else {
    action = 'hold'
    summary = !aboveTrigger && safe && autoOk
      ? 'Valve closed: tank below high-level trigger – storing water'
      : `Valve remains closed: ${firstFail(rules)}`
  }
  return { action, safeToRelease: safe, rules, summary }
}

function firstFail(rules: RuleResult[]): string {
  const f = rules.find((r) => !r.pass)
  return f ? f.detail : 'unknown condition'
}

/** Whether a manual open request may proceed. Manual requests still respect all safety interlocks. */
export function canManualOpen(ctx: ReleaseContext): { ok: boolean; reason: string; rules: RuleResult[] } {
  const rules = safetyInterlocks(ctx)
  const fail = rules.find((r) => !r.pass)
  return fail ? { ok: false, reason: fail.detail, rules } : { ok: true, reason: 'All safety interlocks satisfied', rules }
}
