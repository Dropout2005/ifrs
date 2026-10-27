import { describe, expect, it } from 'vitest'
import { availableL, blockageSignals, freshness, percentFull, rateOfRise, sanitizeTankReading, tankStatus } from './calc'
import { canManualOpen, evaluateRelease, inWindow } from './releasePolicy'
import { canTransitionLeak, nextSuspicionCount, unexplainedLossL } from './leak'
import { can, canConfigureValve, canManualOperate, canReviewRebate, canViewTank } from './rbac'
import { award, balance, checkRedeem, redeemTx } from './rewards'
import { canTransitionRebate, checkEligibility, estimateRebate } from './rebates'
import { buildSeed } from '../data/seed'
import { simulateTick } from '../sim/engine'
import { applyLivePayload } from '../sim/live'
import type { Drain, Tank, Valve } from './types'

const NOW = new Date('2026-11-02T14:00:00').getTime()

function fixture() {
  const s = buildSeed(NOW)
  const tank = structuredClone(s.tanks.find((t) => t.id === 't-sq1')!) as Tank
  const valve = structuredClone(s.valves.find((v) => v.tankId === 't-sq1')!) as Valve
  const drain = structuredClone(s.drains.find((d) => d.id === valve.drainId)!) as Drain
  const tankDevice = s.devices.find((d) => d.id === tank.levelDeviceId)!
  const drainDevice = s.devices.find((d) => d.id === drain.deviceId)!
  tank.lastReadingAt = NOW
  tankDevice.lastSeen = NOW
  drain.lastReadingAt = NOW
  drainDevice.lastSeen = NOW
  drain.levelCm = 20
  drain.history = [
    { t: NOW - 10 * 60_000, v: 19 },
    { t: NOW, v: 20 },
  ]
  return { s, tank, valve, drain, tankDevice, drainDevice }
}

describe('tank calculations', () => {
  it('computes percent full and available capacity', () => {
    expect(percentFull(4500, 18000)).toBe(25)
    expect(availableL(4500, 18000)).toBe(13500)
    expect(availableL(19000, 18000)).toBe(0)
    expect(percentFull(10, 0)).toBe(0)
  })
  it('rejects negative and non-numeric readings', () => {
    expect(sanitizeTankReading(-5, 1000).accepted).toBe(false)
    expect(sanitizeTankReading(NaN, 1000).accepted).toBe(false)
  })
  it('flags readings above capacity as overflow and clamps', () => {
    const r = sanitizeTankReading(1200, 1000)
    expect(r.accepted).toBe(true)
    expect(r.quality).toBe('overflow')
    expect(r.volumeL).toBe(1000)
    expect(sanitizeTankReading(1010, 1000).quality).toBe('ok') // within 2% tolerance
  })
  it('classifies freshness', () => {
    expect(freshness(NOW - 60_000, NOW, 900)).toBe('fresh')
    expect(freshness(NOW - 1800_000, NOW, 900)).toBe('stale')
    expect(freshness(NOW - 5 * 3600_000, NOW, 900)).toBe('offline')
  })
  it('never shows a stale tank as normal', () => {
    const { tank, tankDevice } = fixture()
    tankDevice.lastSeen = NOW - 5 * 3600_000
    expect(tankStatus(tank, tankDevice, NOW)).toBe('offline')
  })
})

describe('release policy', () => {
  it('opens when above trigger and every condition is met', () => {
    const f = fixture()
    f.tank.volumeL = 16000
    const d = evaluateRelease({ ...f, now: NOW, emergencyStop: false })
    expect(d.action).toBe('open')
    expect(d.safeToRelease).toBe(true)
  })
  it('stays closed below the high trigger', () => {
    const f = fixture()
    f.tank.volumeL = 9000
    expect(evaluateRelease({ ...f, now: NOW, emergencyStop: false }).action).toBe('hold')
  })
  it('respects the minimum retained volume', () => {
    const f = fixture()
    f.valve.state = 'open'
    f.tank.volumeL = f.valve.config.minRetainedL + 10
    const d = evaluateRelease({ ...f, now: NOW, emergencyStop: false })
    expect(d.action).toBe('close')
    expect(d.rules.find((r) => r.id === 'min-retained')!.pass).toBe(false)
  })
  it('suspends release when the downstream drain is high', () => {
    const f = fixture()
    f.tank.volumeL = 16500
    f.drain.levelCm = 75
    const d = evaluateRelease({ ...f, now: NOW, emergencyStop: false })
    expect(d.action).toBe('hold')
    expect(d.safeToRelease).toBe(false)
  })
  it('stops an active release when the drain starts rising fast', () => {
    const f = fixture()
    f.valve.state = 'open'
    f.tank.volumeL = 16000
    f.drain.history = [
      { t: NOW - 5 * 60_000, v: 10 },
      { t: NOW, v: 30 },
    ]
    expect(evaluateRelease({ ...f, now: NOW, emergencyStop: false }).action).toBe('close')
  })
  it('treats stale tank data as unsafe', () => {
    const f = fixture()
    f.tank.volumeL = 16500
    f.tank.lastReadingAt = NOW - 3600_000
    f.tankDevice.lastSeen = NOW - 3600_000
    expect(evaluateRelease({ ...f, now: NOW, emergencyStop: false }).action).toBe('hold')
  })
  it('treats stale drain data as unsafe', () => {
    const f = fixture()
    f.tank.volumeL = 16500
    f.drainDevice.lastSeen = NOW - 3600_000
    expect(evaluateRelease({ ...f, now: NOW, emergencyStop: false }).safeToRelease).toBe(false)
  })
  it('never releases with a valve fault or emergency stop', () => {
    const f = fixture()
    f.tank.volumeL = 16500
    f.valve.simFault = true
    expect(evaluateRelease({ ...f, now: NOW, emergencyStop: false }).action).toBe('hold')
    f.valve.simFault = false
    expect(evaluateRelease({ ...f, now: NOW, emergencyStop: true }).action).toBe('hold')
  })
  it('requires a linked downstream drain', () => {
    const f = fixture()
    f.tank.volumeL = 16500
    expect(evaluateRelease({ ...f, drain: undefined, drainDevice: undefined, now: NOW, emergencyStop: false }).action).toBe('hold')
  })
  it('manual open still obeys safety interlocks', () => {
    const f = fixture()
    f.drain.levelCm = 80
    expect(canManualOpen({ ...f, now: NOW, emergencyStop: false }).ok).toBe(false)
  })
  it('handles overnight operating windows', () => {
    const at = (h: number) => new Date(2026, 10, 2, h, 0).getTime()
    expect(inWindow(at(23), '22:00', '06:00')).toBe(true)
    expect(inWindow(at(12), '22:00', '06:00')).toBe(false)
    expect(inWindow(at(12), '00:00', '00:00')).toBe(true)
  })
})

describe('drain monitoring', () => {
  it('computes rate of rise', () => {
    expect(rateOfRise([{ t: 0, v: 10 }, { t: 600_000, v: 20 }])).toBeCloseTo(1)
    expect(rateOfRise([{ t: 0, v: 10 }])).toBeNull()
  })
  it('flags (but does not confirm) blockage when high in dry weather', () => {
    const { drain } = fixture()
    drain.levelCm = 70
    expect(blockageSignals(drain, 0, NOW).length).toBeGreaterThan(0)
    expect(drain.blockageConfirmed).toBe(false)
  })
})

describe('leak detection', () => {
  it('does not treat accounted-for usage as a leak', () => {
    expect(unexplainedLossL({ measuredDeltaL: -50, collectedL: 0, usedL: 40, releasedL: 10, toleranceL: 5 })).toBe(0)
  })
  it('detects unexplained loss beyond tolerance', () => {
    expect(unexplainedLossL({ measuredDeltaL: -60, collectedL: 0, usedL: 40, releasedL: 0, toleranceL: 5 })).toBe(20)
  })
  it('requires sustained evidence and decays', () => {
    expect(nextSuspicionCount(3, 10)).toBe(4)
    expect(nextSuspicionCount(3, 0)).toBe(2)
  })
  it('enforces the alert workflow', () => {
    expect(canTransitionLeak('suspected', 'acknowledged')).toBe(true)
    expect(canTransitionLeak('suspected', 'resolved')).toBe(false)
    expect(canTransitionLeak('resolved', 'suspected')).toBe(false)
  })
  it('simulated hidden leak is eventually detected by the engine', () => {
    const s = buildSeed(NOW)
    s.leaks = []
    s.sim.rain = 0
    const tank = s.tanks.find((t) => t.id === 't-res1a')!
    tank.simLeakLpm = 6
    let t = NOW
    for (let i = 0; i < 10; i++) simulateTick(s, (t += 3000), () => 0.5)
    expect(s.leaks.some((l) => l.tankId === 't-res1a' && l.status === 'suspected')).toBe(true)
  })
  it('no false leak alerts from normal usage', () => {
    const s = buildSeed(NOW)
    s.leaks = []
    s.sim.rain = 0
    for (const tk of s.tanks) tk.simLeakLpm = 0
    let t = NOW
    for (let i = 0; i < 30; i++) simulateTick(s, (t += 3000))
    expect(s.leaks.length).toBe(0)
  })
})

describe('permissions', () => {
  const s = buildSeed(NOW)
  const aaliyah = s.users.find((u) => u.id === 'u-aaliyah')!
  const devon = s.users.find((u) => u.id === 'u-devon')!
  const admin = s.users.find((u) => u.id === 'u-admin')!
  const kTank = s.tanks.find((t) => t.ownerId === 'u-kezia')!
  const aTank = s.tanks.find((t) => t.ownerId === 'u-aaliyah')!
  const kValve = s.valves.find((v) => v.tankId === kTank.id)!
  it('residents cannot view other residents tanks', () => {
    expect(canViewTank(aaliyah, kTank)).toBe(false)
    expect(canViewTank(aaliyah, aTank)).toBe(true)
    expect(canViewTank(devon, kTank)).toBe(true)
  })
  it('shared prototype tank is visible to everyone', () => {
    expect(canViewTank(aaliyah, s.tanks.find((t) => t.id === 't-tatil')!)).toBe(true)
  })
  it('residents cannot operate or configure valves they do not own', () => {
    expect(canManualOperate(aaliyah, kTank, kValve)).toBe(false)
    expect(canConfigureValve(aaliyah, kTank)).toBe(false)
    expect(canConfigureValve(admin, kTank)).toBe(true)
  })
  it('residents cannot change rebate rules or approve rebates', () => {
    expect(can(aaliyah, 'rebate:configure')).toBe(false)
    expect(canReviewRebate(aaliyah, 'u-marcus')).toBe(false)
    expect(canReviewRebate(admin, 'u-admin')).toBe(false) // never your own
    expect(canReviewRebate(admin, 'u-aaliyah')).toBe(true)
  })
  it('disabled users lose all permissions', () => {
    expect(can({ ...admin, disabled: true }, 'audit:view')).toBe(false)
  })
})

describe('rewards', () => {
  it('awards a given activity exactly once', () => {
    const txs = [] as ReturnType<typeof buildSeed>['pointsTx']
    const a = award(txs, { userId: 'u1', ref: 'cleanup:e1', points: 100, note: '', now: NOW, id: 'x1' })
    expect(a).not.toBeNull()
    txs.push(a!)
    expect(award(txs, { userId: 'u1', ref: 'cleanup:e1', points: 100, note: '', now: NOW, id: 'x2' })).toBeNull()
    expect(balance(txs, 'u1')).toBe(100)
  })
  it('redemption checks balance, stock and expiry and updates balance', () => {
    const s = buildSeed(NOW)
    const txs = s.pointsTx
    const shirt = s.rewards.find((r) => r.id === 'rw-shirt')!
    expect(checkRedeem(txs, shirt, 'u-aaliyah', NOW).ok).toBe(false)
    const shout = s.rewards.find((r) => r.id === 'rw-shout')!
    const before = balance(txs, 'u-aaliyah')
    expect(checkRedeem(txs, shout, 'u-aaliyah', NOW).ok).toBe(true)
    txs.push(redeemTx(shout, 'u-aaliyah', NOW, 'r1'))
    expect(balance(txs, 'u-aaliyah')).toBe(before - shout.cost)
    expect(checkRedeem(txs, { ...shout, stock: 0 }, 'u-aaliyah', NOW).ok).toBe(false)
    expect(checkRedeem(txs, { ...shout, expiresAt: NOW - 1 }, 'u-aaliyah', NOW).ok).toBe(false)
  })
})

describe('rebates', () => {
  it('only reviewers decide and never the applicant', () => {
    expect(canTransitionRebate('draft', 'submitted', 'resident', true)).toBe(true)
    expect(canTransitionRebate('under_review', 'approved', 'resident', true)).toBe(false)
    expect(canTransitionRebate('under_review', 'approved', 'admin', false)).toBe(true)
    expect(canTransitionRebate('submitted', 'credited', 'admin', false)).toBe(false)
  })
  it('evaluates eligibility rules', () => {
    const s = buildSeed(NOW)
    const p = s.programmes[0]
    const tanks = s.tanks.filter((t) => t.ownerId === 'u-aaliyah')
    const res = checkEligibility(p, { tanks, devices: s.devices, buildings: s.buildings, pilotCommunityIds: ['c-sq'], installVerified: false })
    expect(res.find((r) => r.rule.kind === 'min-capacity')!.pass).toBe(true)
    expect(res.find((r) => r.rule.kind === 'install-verified')!.pass).toBe(false)
  })
  it('performance model refuses to estimate without verified savings', () => {
    const s = buildSeed(NOW)
    const p = { ...s.programmes[0], model: 'performance' as const }
    expect(estimateRebate(p, { equipmentCostTTD: 0 }, null).amountTTD).toBe(0)
    expect(estimateRebate(p, { equipmentCostTTD: 0 }, 10).basis).toBe('verified')
  })
  it('equipment model caps the rebate', () => {
    const s = buildSeed(NOW)
    const p = { ...s.programmes[0], model: 'equipment' as const }
    expect(estimateRebate(p, { equipmentCostTTD: 100000 }, null).amountTTD).toBe(p.equipmentCapTTD)
  })
})

describe('live sensor adapter', () => {
  it('maps level_pct to litres and rejects unknown devices and replays', () => {
    const s = buildSeed(NOW)
    expect(applyLivePayload(s, { device_id: 'nope', level_pct: 50 }, NOW)).toMatch(/unknown/)
    const msg = applyLivePayload(s, { device_id: 'dev-t-tatil-lvl', level_pct: 50, seq: 5 }, NOW)
    expect(msg).toMatch(/Accepted/)
    const t = s.tanks.find((x) => x.id === 't-tatil')!
    expect(t.volumeL).toBeCloseTo(t.capacityL / 2)
    expect(applyLivePayload(s, { device_id: 'dev-t-tatil-lvl', level_pct: 60, seq: 5 }, NOW)).toMatch(/replayed/)
    expect(applyLivePayload(s, { device_id: 'dev-t-tatil-lvl', volume_l: -3, seq: 6 }, NOW)).toMatch(/Rejected/)
  })
  it('converts ultrasonic distance to volume', () => {
    const s = buildSeed(NOW)
    applyLivePayload(s, { device_id: 'dev-t-tatil-lvl', distance_cm: 30, tank_height_cm: 120 }, NOW)
    const t = s.tanks.find((x) => x.id === 't-tatil')!
    expect(t.volumeL).toBeCloseTo(t.capacityL * 0.75)
  })
})
