import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { buildSeed, type SeedState } from '../data/seed'
import { can, canConfigureValve, canManualOperate, canReviewRebate } from '../domain/rbac'
import { canManualOpen } from '../domain/releasePolicy'
import { canTransitionLeak, LEAK_LABEL } from '../domain/leak'
import { award, checkRedeem, redeemTx } from '../domain/rewards'
import { canTransitionRebate, REBATE_LABEL } from '../domain/rebates'
import { sanitizeTankReading } from '../domain/calc'
import type {
  CitizenReport,
  CleanupEvent,
  LeakStatus,
  RainLevel,
  RebateApplication,
  RebateProgramme,
  ReportCategory,
  ReportStatus,
  SimSettings,
  Tank,
  TaskStatus,
  User,
  ValveConfig,
} from '../domain/types'
import { audit, notify, pushReading, raiseLeak, runAlerts, runValves, simulateTick, uid } from '../sim/engine'
import { applyLivePayload, type LivePayload } from '../sim/live'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  text: string
}

export type Result = { ok: boolean; message: string }

interface UiState {
  currentUserId: string
  toasts: Toast[]
  seededAt: number
}

interface Actions {
  // session / ui
  setUser: (id: string) => void
  toast: (kind: Toast['kind'], text: string) => void
  dismissToast: (id: string) => void
  // simulation
  tick: () => void
  setSim: (p: Partial<SimSettings>) => void
  setRain: (r: RainLevel) => void
  resetDemo: () => void
  setTankVolume: (tankId: string, litres: number) => Result
  setDeviceDisconnected: (deviceId: string, off: boolean) => void
  setDeviceFault: (deviceId: string, fault: boolean) => void
  setLeakProbe: (tankId: string, wet: boolean) => void
  setSimLeak: (tankId: string, lpm: number) => void
  setDrainBlockage: (drainId: string, cm: number) => void
  setValveFault: (valveId: string, fault: boolean) => void
  ingestLive: (payloads: LivePayload[]) => string[]
  // tanks / valves
  addTank: (t: { name: string; buildingId: string; capacityL: number; volumeL: number; catchmentM2: number }) => Result
  updateTank: (tankId: string, p: Partial<Pick<Tank, 'name' | 'highThresholdPct' | 'lowThresholdPct' | 'capacityL'>>) => Result
  updateValveConfig: (valveId: string, cfg: Partial<ValveConfig>) => Result
  setValveMode: (valveId: string, mode: 'auto' | 'manual') => Result
  manualValve: (valveId: string, op: 'open' | 'close') => Result
  setEmergencyStop: (on: boolean) => Result
  // drains
  recordInspection: (drainId: string, kind: 'inspection' | 'basket-clean' | 'repair', note: string, blockage?: 'confirmed' | 'cleared' | 'none') => Result
  updateDrain: (drainId: string, p: { elevatedCm?: number; criticalCm?: number; maxRiseCmPerMin?: number }) => Result
  // leaks
  leakTransition: (leakId: string, to: LeakStatus, note?: string) => Result
  // maintenance
  createTask: (p: { title: string; assetType: 'tank' | 'drain' | 'valve' | 'report' | 'device'; assetId: string; priority: 'low' | 'medium' | 'high'; assigneeId?: string; source: string }) => string
  updateTask: (taskId: string, p: { status?: TaskStatus; assigneeId?: string; note?: string }) => Result
  // reports
  submitReport: (p: { category: ReportCategory; description: string; lat: number; lng: number; locationText: string; photoName?: string }) => Result & { id?: string; duplicateOf?: string }
  reportTransition: (reportId: string, to: ReportStatus, note?: string, team?: string) => Result
  // cleanups
  registerEvent: (eventId: string, on: boolean) => Result
  checkIn: (eventId: string, evidence?: string) => Result
  verifyAttendance: (eventId: string, userId: string) => Result
  completeEvent: (eventId: string, wasteKg: number, summary: string) => Result
  createEvent: (p: Omit<CleanupEvent, 'id' | 'registrations' | 'checkins' | 'verified' | 'completed'>) => Result
  // rewards
  redeem: (rewardId: string) => Result
  updateRewardRule: (ruleId: string, p: { points?: number; active?: boolean }) => Result
  updateReward: (rewardId: string, p: { cost?: number; stock?: number }) => Result
  // rebates
  saveApplication: (p: Partial<RebateApplication> & { programmeId: string }, submit: boolean) => Result
  rebateTransition: (appId: string, to: RebateApplication['status'], p?: { note?: string; amountTTD?: number; reason?: string }) => Result
  updateProgramme: (id: string, p: Partial<RebateProgramme>) => Result
  // notifications
  markRead: (id: string) => void
  markAllRead: () => void
  // admin
  updateUser: (id: string, p: Partial<Pick<User, 'role' | 'disabled' | 'name' | 'publicRecognition' | 'notificationPrefs' | 'accessibility' | 'communityId'>>) => Result
  setDeviceEnabled: (deviceId: string, enabled: boolean) => Result
  updateBuilding: (id: string, p: { lat?: number; lng?: number; installVerified?: boolean }) => Result
}

export type AppState = SeedState & UiState & Actions

const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* storage unavailable – demo still works in memory */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}

const fresh = (): SeedState & UiState => ({ ...buildSeed(Date.now()), currentUserId: 'u-aaliyah', toasts: [], seededAt: Date.now() })

const ok = (message: string): Result => ({ ok: true, message })
const no = (message: string): Result => ({ ok: false, message })

export const useStore = create<AppState>()(
  persist(
    immer((set, get) => {
      const me = () => get().users.find((u) => u.id === get().currentUserId)
      return {
        ...fresh(),

        setUser: (id) => set((s) => void (s.currentUserId = id)),
        toast: (kind, text) => {
          const id = uid('t')
          set((s) => void s.toasts.push({ id, kind, text }))
          setTimeout(() => get().dismissToast(id), 4500)
        },
        dismissToast: (id) => set((s) => void (s.toasts = s.toasts.filter((t) => t.id !== id))),

        tick: () => set((s) => void simulateTick(s as unknown as SeedState, Date.now())),
        setSim: (p) =>
          set((s) => {
            const wasLive = s.sim.dataSource === 'live'
            Object.assign(s.sim, p)
            if (p.dataSource === 'simulated') {
              for (const d of s.devices) if (d.source === 'live') d.source = 'simulated'
            }
            if (!wasLive && s.sim.dataSource === 'live') {
              const d = s.devices.find((x) => x.id === s.sim.liveDeviceId)
              if (d) d.source = 'live'
            }
          }),
        setRain: (r) => set((s) => void (s.sim.rain = r)),
        resetDemo: () => {
          const user = get().currentUserId
          set(() => ({ ...fresh(), currentUserId: user }))
        },
        setTankVolume: (tankId, litres) => {
          const t = get().tanks.find((x) => x.id === tankId)
          if (!t) return no('Tank not found')
          const r = sanitizeTankReading(litres, t.capacityL)
          if (!r.accepted) return no(`Reading rejected: ${r.reason}`)
          const now = Date.now()
          set((s) => {
            const tank = s.tanks.find((x) => x.id === tankId)!
            tank.volumeL = r.volumeL
            tank.quality = r.quality
            tank.lastReadingAt = now
            tank.leakSuspicionCount = 0
            const dev = s.devices.find((d) => d.id === tank.levelDeviceId)
            if (dev && !dev.simDisconnected) dev.lastSeen = now
            pushReading(tank.history, { t: now, v: Math.round(r.volumeL) })
            audit(s as unknown as SeedState, s.currentUserId, 'sim.set-level', tankId, `${Math.round(litres)} L (simulated)`, now)
            runAlerts(s as unknown as SeedState, now)
            runValves(s as unknown as SeedState, now)
          })
          return ok(r.quality === 'overflow' ? `Flagged: ${r.reason}` : 'Simulated reading applied')
        },
        setDeviceDisconnected: (deviceId, off) =>
          set((s) => {
            const d = s.devices.find((x) => x.id === deviceId)
            if (d) {
              d.simDisconnected = off
              if (off) d.lastSeen = Date.now() - 5 * 3_600_000 // jump straight to "offline" for the demo
              else d.lastSeen = Date.now()
              audit(s as unknown as SeedState, s.currentUserId, off ? 'sim.disconnect' : 'sim.reconnect', deviceId, 'Simulation control')
              runAlerts(s as unknown as SeedState, Date.now())
              runValves(s as unknown as SeedState, Date.now())
            }
          }),
        setDeviceFault: (deviceId, fault) =>
          set((s) => {
            const d = s.devices.find((x) => x.id === deviceId)
            if (d) d.fault = fault
            runAlerts(s as unknown as SeedState, Date.now())
          }),
        setLeakProbe: (tankId, wet) =>
          set((s) => {
            const tank = s.tanks.find((t) => t.id === tankId)
            const probe = s.devices.find((d) => d.id === tank?.leakDeviceId)
            if (tank && probe) {
              probe.wet = wet
              if (wet) raiseLeak(s as unknown as SeedState, tank as Tank, 'leak-sensor', 'Leak probe at the tank base is detecting water.', 'high', Date.now())
            }
          }),
        setSimLeak: (tankId, lpm) =>
          set((s) => {
            const t = s.tanks.find((x) => x.id === tankId)
            if (t) {
              t.simLeakLpm = lpm
              if (lpm === 0) t.leakSuspicionCount = 0
            }
          }),
        setDrainBlockage: (drainId, cm) =>
          set((s) => {
            const d = s.drains.find((x) => x.id === drainId)
            if (d) d.simBlockageCm = cm
          }),
        setValveFault: (valveId, fault) =>
          set((s) => {
            const v = s.valves.find((x) => x.id === valveId)
            if (v) v.simFault = fault
            runValves(s as unknown as SeedState, Date.now())
          }),
        ingestLive: (payloads) => {
          const out: string[] = []
          set((s) => {
            for (const p of payloads) out.push(applyLivePayload(s as unknown as SeedState, p, Date.now()))
            s.sim.liveLastStatus = out[out.length - 1]
          })
          return out
        },

        addTank: (p) => {
          const u = me()
          const b = get().buildings.find((x) => x.id === p.buildingId)
          if (!u || !can(u, 'tank:add')) return no('You do not have permission to add tanks')
          if (!b) return no('Choose a building')
          if (u.role === 'resident' && b.ownerId !== u.id) return no('You can only add tanks to your own property')
          if (!(p.capacityL > 0) || p.capacityL > 200_000) return no('Capacity must be between 1 and 200,000 L')
          const r = sanitizeTankReading(p.volumeL, p.capacityL)
          if (!r.accepted || r.quality !== 'ok') return no('Starting volume must be between 0 and the capacity')
          const id = uid('t')
          const now = Date.now()
          set((s) => {
            const devId = `dev-${id}-lvl`
            s.devices.push({ id: devId, kind: 'tank-level', assetId: id, model: 'Ultrasonic level sensor (simulated)', firmware: '1.4.2', lastSeen: now, fault: false, source: 'simulated', enabled: true, battery: 100 })
            s.tanks.push({ id, name: p.name.trim() || 'New tank', buildingId: p.buildingId, ownerId: b.ownerId ?? u.id, capacityL: p.capacityL, volumeL: r.volumeL, highThresholdPct: 90, lowThresholdPct: 15, levelDeviceId: devId, catchmentM2: p.catchmentM2 || 50, history: [{ t: now, v: r.volumeL }], lastReadingAt: now, quality: 'ok', usageLpm: 0.8, simLeakLpm: 0, leakSuspicionCount: 0, collectedL: 0, usedL: 0, releasedL: 0, alertState: 'none' })
            audit(s as unknown as SeedState, u.id, 'tank.add', id, `${p.name} ${p.capacityL} L`, now)
          })
          return { ok: true, message: `Tank added with a simulated sensor`, id } as Result
        },
        updateTank: (tankId, p) => {
          const u = me()
          const t = get().tanks.find((x) => x.id === tankId)
          if (!t) return no('Tank not found')
          if (!canConfigureValve(u, t as Tank)) return no('Only the owner or an administrator can change this tank')
          if (p.highThresholdPct !== undefined && (p.highThresholdPct < 50 || p.highThresholdPct > 99)) return no('High threshold must be 50–99%')
          if (p.lowThresholdPct !== undefined && (p.lowThresholdPct < 0 || p.lowThresholdPct > 50)) return no('Low threshold must be 0–50%')
          set((s) => {
            Object.assign(s.tanks.find((x) => x.id === tankId)!, p)
            audit(s as unknown as SeedState, u!.id, 'tank.update', tankId, JSON.stringify(p))
          })
          return ok('Tank settings saved')
        },
        updateValveConfig: (valveId, cfg) => {
          const u = me()
          const v = get().valves.find((x) => x.id === valveId)
          const t = get().tanks.find((x) => x.id === v?.tankId)
          if (!v || !t) return no('Valve not found')
          if (!canConfigureValve(u, t as Tank)) return no('You do not have permission to configure this valve')
          const next = { ...v.config, ...cfg }
          if (next.minRetainedL < 0 || next.minRetainedL >= t.capacityL) return no('Minimum retained volume must be between 0 and capacity')
          if (next.highTriggerL <= next.minRetainedL) return no('High trigger must be above the minimum retained volume')
          if (next.highTriggerL > t.capacityL) return no('High trigger cannot exceed capacity')
          if (next.maxReleaseLpm <= 0 || next.maxReleaseLpm > 500) return no('Release rate must be 1–500 L/min')
          if (!/^\d{2}:\d{2}$/.test(next.windowStart) || !/^\d{2}:\d{2}$/.test(next.windowEnd)) return no('Use HH:MM for the operating window')
          if (cfg.manualOverrideRoles && u?.role !== 'admin') return no('Only administrators can change override permissions')
          set((s) => {
            const vv = s.valves.find((x) => x.id === valveId)!
            vv.config = next
            vv.log.unshift({ id: uid('vl'), t: Date.now(), action: 'config', mode: vv.mode, by: u!.id, reason: 'Release settings updated' })
            audit(s as unknown as SeedState, u!.id, 'valve.config', valveId, JSON.stringify(cfg))
            runValves(s as unknown as SeedState, Date.now())
          })
          return ok('Release settings saved and re-evaluated')
        },
        setValveMode: (valveId, mode) => {
          const u = me()
          const v = get().valves.find((x) => x.id === valveId)
          const t = get().tanks.find((x) => x.id === v?.tankId)
          if (!v || !t) return no('Valve not found')
          if (!canManualOperate(u, t as Tank, v as never)) return no('You do not have permission to change the valve mode')
          set((s) => {
            const vv = s.valves.find((x) => x.id === valveId)!
            vv.mode = mode
            vv.log.unshift({ id: uid('vl'), t: Date.now(), action: 'config', mode, by: u!.id, reason: `Switched to ${mode} mode` })
            audit(s as unknown as SeedState, u!.id, 'valve.mode', valveId, mode)
            runValves(s as unknown as SeedState, Date.now())
          })
          return ok(`Valve set to ${mode} mode`)
        },
        manualValve: (valveId, op) => {
          const u = me()
          const st = get()
          const v = st.valves.find((x) => x.id === valveId)
          const t = st.tanks.find((x) => x.id === v?.tankId)
          if (!v || !t) return no('Valve not found')
          if (!canManualOperate(u, t as Tank, v as never)) return no('You are not permitted to operate this valve')
          if (v.mode !== 'manual') return no('Switch the valve to manual mode first')
          if (op === 'open') {
            const drain = st.drains.find((d) => d.id === v.drainId)
            const chk = canManualOpen({ tank: t as Tank, valve: v as never, tankDevice: st.devices.find((d) => d.id === t.levelDeviceId), drain, drainDevice: drain ? st.devices.find((d) => d.id === drain.deviceId) : undefined, now: Date.now(), emergencyStop: st.sim.emergencyStop })
            if (!chk.ok) {
              set((s) => audit(s as unknown as SeedState, u!.id, 'valve.manual-open.blocked', valveId, chk.reason))
              return no(`Blocked by safety interlock: ${chk.reason}`)
            }
          }
          set((s) => {
            const vv = s.valves.find((x) => x.id === valveId)!
            const now = Date.now()
            vv.state = op === 'open' ? 'opening' : 'closing'
            vv.stateSince = now
            vv.lastOperationAt = now
            vv.lastOperationBy = u!.id
            vv.log.unshift({ id: uid('vl'), t: now, action: op, mode: 'manual', by: u!.id, reason: `Manual ${op} requested by ${u!.name}` })
            audit(s as unknown as SeedState, u!.id, `valve.manual-${op}`, valveId, 'Manual override (simulated controller)', now)
          })
          return ok(`Manual ${op} sent to simulated controller`)
        },
        setEmergencyStop: (on) => {
          const u = me()
          if (!can(u, 'estop')) return no('Only maintenance staff and administrators can use the emergency stop')
          set((s) => {
            s.sim.emergencyStop = on
            const now = Date.now()
            for (const v of s.valves) {
              if (on && (v.state === 'open' || v.state === 'opening')) {
                v.state = 'closing'
                v.stateSince = now
              }
              v.log.unshift({ id: uid('vl'), t: now, action: 'estop', mode: v.mode, by: u!.id, reason: on ? 'Emergency stop engaged' : 'Emergency stop released' })
            }
            audit(s as unknown as SeedState, u!.id, on ? 'estop.engage' : 'estop.release', 'all-valves', '', now)
            notify(s as unknown as SeedState, { t: now, kind: 'device', severity: on ? 'critical' : 'info', title: on ? 'Emergency stop engaged' : 'Emergency stop released', body: on ? 'All automatic and manual releases are disabled.' : 'Release policies resume normal evaluation.', roles: ['maintenance', 'admin'] })
            runValves(s as unknown as SeedState, now)
          })
          return ok(on ? 'Emergency stop engaged – all releases disabled' : 'Emergency stop released')
        },

        recordInspection: (drainId, kind, note, blockage) => {
          const u = me()
          if (!can(u, 'drain:inspect')) return no('Only maintenance staff can record inspections')
          set((s) => {
            const d = s.drains.find((x) => x.id === drainId)!
            const now = Date.now()
            d.inspections.unshift({ t: now, by: u!.id, note: note || (kind === 'basket-clean' ? 'Basket emptied' : 'Inspection recorded'), kind })
            if (kind === 'basket-clean') d.basketLastCleaned = now
            if (blockage === 'confirmed') d.blockageConfirmed = true
            if (blockage === 'cleared' || kind === 'basket-clean') {
              d.blockageConfirmed = false
              d.simBlockageCm = 0
            }
            audit(s as unknown as SeedState, u!.id, `drain.${kind}`, drainId, note, now)
          })
          return ok('Inspection recorded')
        },
        updateDrain: (drainId, p) => {
          const u = me()
          if (!can(u, 'admin:thresholds')) return no('Only administrators can change thresholds')
          const d = get().drains.find((x) => x.id === drainId)!
          const el = p.elevatedCm ?? d.elevatedCm
          const cr = p.criticalCm ?? d.criticalCm
          if (!(el > 0 && cr > el && cr <= d.rangeCm)) return no('Need 0 < elevated < critical ≤ sensor range')
          set((s) => {
            Object.assign(s.drains.find((x) => x.id === drainId)!, p)
            audit(s as unknown as SeedState, u!.id, 'drain.thresholds', drainId, JSON.stringify(p))
          })
          return ok('Thresholds saved')
        },

        leakTransition: (leakId, to, note) => {
          const u = me()
          const st = get()
          const l = st.leaks.find((x) => x.id === leakId)
          const t = st.tanks.find((x) => x.id === l?.tankId)
          if (!l || !t || !u) return no('Alert not found')
          const isOwner = t.ownerId === u.id
          const staff = can(u, 'leak:workflow')
          if (!canTransitionLeak(l.status, to)) return no(`Cannot move from ${LEAK_LABEL[l.status]} to ${LEAK_LABEL[to]}`)
          if (to === 'acknowledged' ? !(isOwner || staff) : !staff) return no(to === 'acknowledged' ? 'Only the owner or staff can acknowledge' : 'Only maintenance staff can do this step')
          set((s) => {
            const ll = s.leaks.find((x) => x.id === leakId)!
            const now = Date.now()
            ll.status = to
            ll.timeline.push({ t: now, by: u.id, action: LEAK_LABEL[to], note })
            if (to === 'confirmed' && !ll.maintenanceTaskId) {
              const tid = uid('mt')
              s.tasks.unshift({ id: tid, title: `Repair leak – ${t.name}`, assetType: 'tank', assetId: t.id, status: 'open', priority: ll.severity === 'high' ? 'high' : 'medium', createdAt: now, source: `Leak alert ${ll.id}`, notes: [] })
              ll.maintenanceTaskId = tid
            }
            if (to === 'resolved' || to === 'false_alarm') {
              const tank = s.tanks.find((x) => x.id === t.id)!
              tank.simLeakLpm = 0
              tank.leakSuspicionCount = 0
              const probe = s.devices.find((d) => d.id === tank.leakDeviceId)
              if (probe) probe.wet = false
            }
            notify(s as unknown as SeedState, { t: now, kind: 'leak', severity: to === 'resolved' ? 'success' : 'info', title: `Leak alert ${LEAK_LABEL[to].toLowerCase()}: ${t.name}`, body: note || `Status changed by ${u.name}`, link: '/leaks', userIds: [t.ownerId], roles: ['maintenance'] })
            audit(s as unknown as SeedState, u.id, `leak.${to}`, leakId, note ?? '', now)
          })
          return ok(`Alert marked ${LEAK_LABEL[to].toLowerCase()}`)
        },

        createTask: (p) => {
          const id = uid('mt')
          set((s) => {
            s.tasks.unshift({ id, ...p, status: p.assigneeId ? 'assigned' : 'open', createdAt: Date.now(), notes: [] })
            audit(s as unknown as SeedState, s.currentUserId, 'task.create', id, p.title)
          })
          return id
        },
        updateTask: (taskId, p) => {
          const u = me()
          if (!can(u, 'maintenance:manage')) return no('Only maintenance staff can update tasks')
          set((s) => {
            const t = s.tasks.find((x) => x.id === taskId)!
            const now = Date.now()
            if (p.assigneeId !== undefined) {
              t.assigneeId = p.assigneeId || undefined
              if (t.status === 'open' && p.assigneeId) t.status = 'assigned'
              t.notes.push({ t: now, by: u!.id, action: p.assigneeId ? `Assigned to ${s.users.find((x) => x.id === p.assigneeId)?.name}` : 'Unassigned' })
              if (p.assigneeId) notify(s as unknown as SeedState, { t: now, kind: 'maintenance', severity: 'info', title: `New assignment: ${t.title}`, body: `Priority ${t.priority}`, link: '/maintenance', userIds: [p.assigneeId] })
            }
            if (p.status) {
              t.status = p.status
              t.notes.push({ t: now, by: u!.id, action: `Status: ${p.status.replace('_', ' ')}`, note: p.note })
            } else if (p.note) t.notes.push({ t: now, by: u!.id, action: 'Note', note: p.note })
            audit(s as unknown as SeedState, u!.id, 'task.update', taskId, JSON.stringify(p), now)
          })
          return ok('Task updated')
        },

        submitReport: (p) => {
          const u = me()
          if (!can(u, 'report:create')) return no('Sign in to submit reports')
          if (p.description.trim().length < 10) return no('Please describe the problem (at least 10 characters)')
          if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return no('Choose a location')
          const now = Date.now()
          // Duplicate check: same category, open, within ~75 m, last 48 h
          const dup = get().reports.find(
            (r) =>
              r.category === p.category &&
              !['resolved', 'rejected', 'duplicate'].includes(r.status) &&
              now - r.createdAt < 48 * 3_600_000 &&
              Math.hypot((r.lat - p.lat) * 111_000, (r.lng - p.lng) * 109_000) < 75,
          )
          const id = uid('rp')
          set((s) => {
            s.reports.unshift({ id, ...p, description: p.description.trim(), createdAt: now, reporterId: u!.id, status: 'submitted', history: [{ t: now, by: u!.id, action: 'Submitted' }], possibleDuplicateOf: dup?.id })
            notify(s as unknown as SeedState, { t: now, kind: 'community', severity: 'info', title: 'New citizen report', body: `${p.category.replace('-', ' ')} – ${p.locationText}`, link: '/community', roles: ['maintenance'] })
            audit(s as unknown as SeedState, u!.id, 'report.submit', id, p.category, now)
          })
          return { ok: true, message: dup ? 'Submitted – a similar nearby report already exists, staff will check for duplicates' : 'Report submitted. Points are awarded only after staff verify it.', id, duplicateOf: dup?.id }
        },
        reportTransition: (reportId, to, note, team) => {
          const u = me()
          if (!can(u, 'report:verify')) return no('Only staff can update report status')
          const r = get().reports.find((x) => x.id === reportId)
          if (!r) return no('Report not found')
          if (r.reporterId === u!.id) return no('You cannot verify your own report')
          let awarded = false
          set((s) => {
            const rr = s.reports.find((x) => x.id === reportId) as CitizenReport
            const now = Date.now()
            rr.status = to
            if (team) rr.assignedTeam = team
            if (to === 'resolved' && note) rr.resolutionNotes = note
            rr.history.push({ t: now, by: u!.id, action: to.replace(/_/g, ' '), note })
            if (to === 'verified') {
              const rule = s.rewardRules.find((x) => x.activity === 'verified-report' && x.active)
              if (rule) {
                const tx = award(s.pointsTx as never, { userId: rr.reporterId, ref: `report:${rr.id}`, points: rule.points, note: `Report verified: ${rr.category.replace('-', ' ')}`, now, id: uid('px') })
                if (tx) {
                  s.pointsTx.unshift(tx)
                  awarded = true
                  notify(s as unknown as SeedState, { t: now, kind: 'rewards', severity: 'success', title: `+${tx.delta} points`, body: 'Your report was verified. Thank you!', link: '/rewards', userIds: [rr.reporterId] })
                }
              }
            }
            notify(s as unknown as SeedState, { t: now, kind: 'community', severity: 'info', title: `Report ${to.replace(/_/g, ' ')}`, body: rr.locationText, link: '/community', userIds: [rr.reporterId] })
            audit(s as unknown as SeedState, u!.id, `report.${to}`, reportId, note ?? '', now)
          })
          return ok(`Report marked ${to.replace(/_/g, ' ')}${awarded ? ' – reporter awarded points' : ''}`)
        },

        registerEvent: (eventId, on) => {
          const u = me()
          const e = get().events.find((x) => x.id === eventId)
          if (!u || !e) return no('Event not found')
          if (e.completed || e.end < Date.now()) return no('This event has ended')
          if (on && e.registrations.length >= e.capacity) return no('Event is full')
          set((s) => {
            const ee = s.events.find((x) => x.id === eventId)!
            ee.registrations = ee.registrations.filter((r) => r.userId !== u.id)
            if (on) ee.registrations.push({ userId: u.id, at: Date.now() })
          })
          return ok(on ? 'You are registered – see you there!' : 'Registration cancelled')
        },
        checkIn: (eventId, evidence) => {
          const u = me()
          const e = get().events.find((x) => x.id === eventId)
          if (!u || !e) return no('Event not found')
          const now = Date.now()
          if (now < e.start - 30 * 60_000 || now > e.end) return no('Check-in opens 30 minutes before the event and closes when it ends')
          if (!e.registrations.some((r) => r.userId === u.id)) return no('Register for the event first')
          if (e.checkins.some((c) => c.userId === u.id)) return no('Already checked in')
          set((s) => void s.events.find((x) => x.id === eventId)!.checkins.push({ userId: u.id, at: now, evidence }))
          return ok('Checked in. An organiser will verify your participation.')
        },
        verifyAttendance: (eventId, userId) => {
          const u = me()
          if (!can(u, 'cleanup:organize')) return no('Only organisers can verify attendance')
          if (u!.id === userId) return no('You cannot verify your own attendance')
          const e = get().events.find((x) => x.id === eventId)
          if (!e) return no('Event not found')
          if (!e.checkins.some((c) => c.userId === userId)) return no('Participant has not checked in')
          if (e.verified.some((v) => v.userId === userId)) return no('Already verified – points are awarded only once')
          let msg = 'Attendance verified'
          set((s) => {
            const ee = s.events.find((x) => x.id === eventId)!
            const now = Date.now()
            ee.verified.push({ userId, at: now, by: u!.id })
            const rule = s.rewardRules.find((x) => x.activity === 'cleanup' && x.active)
            const pts = ee.points || rule?.points || 0
            const tx = award(s.pointsTx as never, { userId, ref: `cleanup:${eventId}`, points: pts, note: `Verified: ${ee.title}`, now, id: uid('px') })
            if (tx) {
              s.pointsTx.unshift(tx)
              msg = `Verified – ${pts} points awarded`
              notify(s as unknown as SeedState, { t: now, kind: 'rewards', severity: 'success', title: `+${pts} points`, body: `Thanks for joining ${ee.title}!`, link: '/rewards', userIds: [userId] })
            }
            audit(s as unknown as SeedState, u!.id, 'cleanup.verify', eventId, userId, now)
          })
          return ok(msg)
        },
        completeEvent: (eventId, wasteKg, summary) => {
          const u = me()
          if (!can(u, 'cleanup:organize')) return no('Only organisers can close events')
          if (!(wasteKg >= 0)) return no('Enter waste collected (kg)')
          set((s) => {
            const e = s.events.find((x) => x.id === eventId)!
            e.completed = true
            e.wasteKg = wasteKg
            e.summary = summary
            audit(s as unknown as SeedState, u!.id, 'cleanup.complete', eventId, `${wasteKg} kg`)
          })
          return ok('Event completed and summary published')
        },
        createEvent: (p) => {
          const u = me()
          if (!can(u, 'cleanup:organize')) return no('Only organisers can create events')
          if (!p.title.trim() || p.end <= p.start) return no('Enter a title and a valid time range')
          const id = uid('ev')
          set((s) => {
            s.events.unshift({ ...p, id, registrations: [], checkins: [], verified: [], completed: false })
            notify(s as unknown as SeedState, { t: Date.now(), kind: 'community', severity: 'info', title: `New cleanup: ${p.title}`, body: `${p.locationName} – ${new Date(p.start).toLocaleString()}`, link: '/community', roles: ['resident'] })
            audit(s as unknown as SeedState, u!.id, 'cleanup.create', id, p.title)
          })
          return ok('Event created')
        },

        redeem: (rewardId) => {
          const u = me()
          const st = get()
          const rw = st.rewards.find((x) => x.id === rewardId)
          if (!u || !rw) return no('Reward not found')
          if (!can(u, 'rewards:redeem')) return no('Only residents can redeem rewards')
          const chk = checkRedeem(st.pointsTx as never, rw, u.id, Date.now())
          if (!chk.ok) return no(chk.reason)
          set((s) => {
            const now = Date.now()
            const tx = redeemTx(rw, u.id, now, uid('px'))
            s.pointsTx.unshift(tx)
            s.rewards.find((x) => x.id === rewardId)!.stock -= 1
            notify(s as unknown as SeedState, { t: now, kind: 'rewards', severity: 'success', title: `Redeemed: ${rw.name}`, body: `${rw.cost} points used. ${rw.conditions}`, link: '/rewards', userIds: [u.id] })
            audit(s as unknown as SeedState, u.id, 'reward.redeem', rewardId, `-${rw.cost}`, now)
          })
          return ok(`Redeemed ${rw.name}`)
        },
        updateRewardRule: (ruleId, p) => {
          const u = me()
          if (!can(u, 'rewards:manage')) return no('Administrators only')
          if (p.points !== undefined && (p.points < 0 || p.points > 1000)) return no('Points must be 0–1000')
          set((s) => {
            Object.assign(s.rewardRules.find((x) => x.id === ruleId)!, p)
            audit(s as unknown as SeedState, u!.id, 'reward.rule', ruleId, JSON.stringify(p))
          })
          return ok('Reward rule saved')
        },
        updateReward: (rewardId, p) => {
          const u = me()
          if (!can(u, 'rewards:manage')) return no('Administrators only')
          set((s) => {
            Object.assign(s.rewards.find((x) => x.id === rewardId)!, p)
            audit(s as unknown as SeedState, u!.id, 'reward.update', rewardId, JSON.stringify(p))
          })
          return ok('Reward saved')
        },

        saveApplication: (p, submit) => {
          const u = me()
          if (!can(u, 'rebate:apply')) return no('Only residents can apply')
          const prog = get().programmes.find((x) => x.id === p.programmeId)
          if (!prog || !prog.active) return no('Programme is not accepting applications')
          if (!p.tankIds?.length) return no('Select at least one tank')
          if (!/^\d{4}$/.test(p.accountRefLast4 ?? '')) return no('Enter the last 4 digits of your utility account only')
          const existing = get().applications.find((a) => a.userId === u!.id && a.programmeId === p.programmeId && !['rejected', 'closed'].includes(a.status))
          if (existing && existing.id !== p.id) return no('You already have an application for this programme')
          const now = Date.now()
          const id = p.id ?? uid('ra')
          set((s) => {
            let a = s.applications.find((x) => x.id === id)
            if (!a) {
              a = { id, userId: u!.id, programmeId: p.programmeId, status: 'draft', tankIds: [], propertyRef: '', accountRefLast4: '', equipmentCostTTD: 0, documents: [], createdAt: now, history: [{ t: now, by: u!.id, action: 'Draft created' }] }
              s.applications.unshift(a)
            }
            Object.assign(a, { tankIds: p.tankIds, propertyRef: p.propertyRef ?? a.propertyRef, accountRefLast4: p.accountRefLast4, equipmentCostTTD: p.equipmentCostTTD ?? a.equipmentCostTTD, documents: p.documents ?? a.documents })
            if (submit && (a.status === 'draft' || a.status === 'info_required')) {
              a.status = 'submitted'
              a.history.push({ t: now, by: u!.id, action: 'Submitted' })
              notify(s as unknown as SeedState, { t: now, kind: 'rebates', severity: 'info', title: 'Rebate application submitted', body: 'Applications are reviewed by programme staff.', link: '/rebates', roles: ['admin'] })
            }
            audit(s as unknown as SeedState, u!.id, submit ? 'rebate.submit' : 'rebate.draft', id, '', now)
          })
          return ok(submit ? 'Application submitted' : 'Draft saved')
        },
        rebateTransition: (appId, to, p) => {
          const u = me()
          const st = get()
          const a = st.applications.find((x) => x.id === appId)
          if (!u || !a) return no('Application not found')
          const isApplicant = a.userId === u.id
          if (!isApplicant && !canReviewRebate(u, a.userId)) return no('You are not permitted to review applications')
          if (!canTransitionRebate(a.status, to, u.role, isApplicant)) return no(isApplicant && to !== 'submitted' ? 'Applicants cannot make decisions on their own application' : `Cannot move from ${REBATE_LABEL[a.status]} to ${REBATE_LABEL[to]}`)
          if (to === 'approved') {
            const prog = st.programmes.find((x) => x.id === a.programmeId)!
            const amt = p?.amountTTD ?? 0
            if (!(amt > 0)) return no('Enter the approved amount')
            const committed = st.applications.filter((x) => x.programmeId === prog.id && x.decision && ['approved', 'credited', 'closed'].includes(x.status)).reduce((s2, x) => s2 + (x.decision?.amountTTD ?? 0), 0)
            if (committed + amt > prog.fundingCapTTD) return no('Approval would exceed the programme funding cap')
          }
          if ((to === 'rejected' || to === 'info_required') && !(p?.reason || p?.note)) return no('A reason is required so the applicant knows what to do')
          set((s) => {
            const aa = s.applications.find((x) => x.id === appId)!
            const now = Date.now()
            aa.status = to
            aa.history.push({ t: now, by: u.id, action: REBATE_LABEL[to], note: p?.reason ?? p?.note })
            if (to === 'approved' || to === 'rejected') aa.decision = { by: u.id, t: now, amountTTD: to === 'approved' ? p!.amountTTD! : 0, reason: p?.reason ?? p?.note ?? '' }
            if (to === 'info_required') aa.infoRequest = p?.reason ?? p?.note
            notify(s as unknown as SeedState, { t: now, kind: 'rebates', severity: to === 'rejected' ? 'warning' : 'info', title: `Rebate application: ${REBATE_LABEL[to]}`, body: p?.reason ?? p?.note ?? '', link: '/rebates', userIds: [aa.userId] })
            audit(s as unknown as SeedState, u.id, `rebate.${to}`, appId, p?.reason ?? p?.note ?? String(p?.amountTTD ?? ''), now)
          })
          return ok(`Application ${REBATE_LABEL[to].toLowerCase()}`)
        },
        updateProgramme: (id, p) => {
          const u = me()
          if (!can(u, 'rebate:configure')) return no('Administrators only')
          set((s) => {
            Object.assign(s.programmes.find((x) => x.id === id)!, p)
            audit(s as unknown as SeedState, u!.id, 'rebate.programme', id, Object.keys(p).join(', '))
          })
          return ok('Programme settings saved')
        },

        markRead: (id) =>
          set((s) => {
            const n = s.notifications.find((x) => x.id === id)
            if (n && !n.readBy.includes(s.currentUserId)) n.readBy.push(s.currentUserId)
          }),
        markAllRead: () =>
          set((s) => {
            for (const n of s.notifications) if (!n.readBy.includes(s.currentUserId)) n.readBy.push(s.currentUserId)
          }),

        updateUser: (id, p) => {
          const u = me()
          const self = u?.id === id
          const adminOnly = p.role !== undefined || p.disabled !== undefined
          if (adminOnly && !can(u, 'admin:users')) return no('Administrators only')
          if (!self && !can(u, 'admin:users')) return no('You can only edit your own profile')
          if (self && p.disabled) return no('You cannot disable your own account')
          set((s) => {
            Object.assign(s.users.find((x) => x.id === id)!, p)
            if (adminOnly) audit(s as unknown as SeedState, u!.id, 'user.update', id, JSON.stringify(p))
          })
          return ok('Saved')
        },
        setDeviceEnabled: (deviceId, enabled) => {
          const u = me()
          if (!can(u, 'admin:devices')) return no('Administrators only')
          set((s) => {
            s.devices.find((x) => x.id === deviceId)!.enabled = enabled
            audit(s as unknown as SeedState, u!.id, enabled ? 'device.enable' : 'device.disable', deviceId, '')
            runValves(s as unknown as SeedState, Date.now())
          })
          return ok(enabled ? 'Device enabled' : 'Device disabled')
        },
        updateBuilding: (id, p) => {
          const u = me()
          if (!can(u, 'admin:devices') && !(p.installVerified !== undefined && can(u, 'drain:inspect'))) return no('Not permitted')
          set((s) => {
            Object.assign(s.buildings.find((x) => x.id === id)!, p)
            audit(s as unknown as SeedState, u!.id, 'building.update', id, JSON.stringify(p))
          })
          return ok('Building updated')
        },
      }
    }),
    {
      name: 'ifrs-demo-v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { toasts, ...rest } = s
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<AppState>
      },
    },
  ),
)

// ---------- selectors ----------
export const useMe = () => useStore((s) => s.users.find((u) => u.id === s.currentUserId)!)
