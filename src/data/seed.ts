import type {
  AppNotification,
  AuditEntry,
  Building,
  CitizenReport,
  CleanupEvent,
  Community,
  Device,
  Drain,
  LeakAlert,
  MaintenanceTask,
  PointsTx,
  RebateApplication,
  RebateProgramme,
  Reading,
  Reward,
  RewardRule,
  SimSettings,
  Tank,
  User,
  Valve,
  ValveConfig,
} from '../domain/types'

/**
 * DEMO SEED DATA – every person, property, record and reading below is fictional
 * and exists only to demonstrate the platform. Street names are real places in
 * Port of Spain used for context; coordinates are approximate.
 */

const H = 3_600_000
const D = 24 * H

// Deterministic PRNG so every visitor gets the same starting demo.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export const COMMUNITIES: Community[] = [
  { id: 'c-sq', name: 'South Quay / Wrightson Road', pilot: true },
  { id: 'c-dt', name: 'Downtown Port of Spain', pilot: true },
  { id: 'c-sc', name: 'St Clair / Newtown', pilot: false },
  { id: 'c-wb', name: 'Woodbrook', pilot: false },
]

const prefs = {
  tank: true,
  leak: true,
  drain: true,
  device: true,
  maintenance: true,
  community: true,
  rewards: true,
  rebates: true,
  channelEmail: false,
  channelSms: false,
}
const access = { largeText: false, reduceMotion: false, highContrast: false }

export const USERS: User[] = [
  { id: 'u-aaliyah', name: 'Aaliyah Mohammed', role: 'resident', email: 'aaliyah@example.tt', communityId: 'c-wb', title: 'Homeowner (demo persona)', publicRecognition: true, notificationPrefs: { ...prefs }, accessibility: { ...access } },
  { id: 'u-marcus', name: 'Marcus Charles', role: 'resident', email: 'marcus@example.tt', communityId: 'c-dt', title: 'Resident (demo persona)', publicRecognition: false, notificationPrefs: { ...prefs }, accessibility: { ...access } },
  { id: 'u-kezia', name: 'Kezia Phillip', role: 'resident', email: 'kezia@example.tt', communityId: 'c-sq', title: 'Building manager, South Quay (demo persona)', publicRecognition: true, notificationPrefs: { ...prefs }, accessibility: { ...access } },
  { id: 'u-devon', name: 'Devon Ramdial', role: 'maintenance', email: 'devon@example.tt', communityId: 'c-sq', title: 'Drainage maintenance crew (demo persona)', publicRecognition: true, notificationPrefs: { ...prefs }, accessibility: { ...access } },
  { id: 'u-admin', name: 'IFRS Administrator', role: 'admin', email: 'admin@example.tt', communityId: 'c-sc', title: 'Department of Dry Affairs', publicRecognition: false, notificationPrefs: { ...prefs }, accessibility: { ...access } },
]

export const BUILDINGS: Building[] = [
  {
    id: 'b-tatil',
    name: 'Tatil Building – IFRS prototype station',
    communityId: 'c-sc',
    ownerId: 'u-admin',
    kind: 'commercial',
    address: 'Maraval Road, Port of Spain (approx. location)',
    lat: 10.6718,
    lng: -61.5209,
    publicLocation: true,
    isPrototypeSite: true,
    installVerified: true,
    note: 'Live demonstration site. Readings are simulated until the Arduino prototype is connected.',
  },
  { id: 'b-sq1', name: 'South Quay Commercial Block (example)', communityId: 'c-sq', ownerId: 'u-kezia', kind: 'commercial', address: 'South Quay near Broadway', lat: 10.6501, lng: -61.5084, publicLocation: true, installVerified: true },
  { id: 'b-wr1', name: 'Wrightson Road Office (example)', communityId: 'c-sq', ownerId: 'u-kezia', kind: 'commercial', address: 'Wrightson Road', lat: 10.6516, lng: -61.5178, publicLocation: true, installVerified: true },
  { id: 'b-res1', name: 'Mohammed residence (example)', communityId: 'c-wb', ownerId: 'u-aaliyah', kind: 'residential', address: 'Woodbrook (private)', lat: 10.6634, lng: -61.5281, publicLocation: false, installVerified: false },
  { id: 'b-res2', name: 'Charles residence (example)', communityId: 'c-dt', ownerId: 'u-marcus', kind: 'residential', address: 'East Port of Spain (private)', lat: 10.6561, lng: -61.5052, publicLocation: false, installVerified: true },
]

const baseValve = (over: Partial<ValveConfig>): ValveConfig => ({
  minRetainedL: 2000,
  highTriggerL: 14000,
  maxReleaseLpm: 60,
  windowStart: '00:00',
  windowEnd: '00:00',
  autoEnabled: true,
  manualOverrideRoles: ['admin', 'maintenance', 'resident'],
  drainSuspendCm: 60,
  maxDrainRiseCmPerMin: 1.5,
  staleAfterSec: 15 * 60,
  ...over,
})

interface TankSeed {
  id: string
  name: string
  buildingId: string
  ownerId: string
  capacityL: number
  pct: number
  catchmentM2: number
  usageLpm: number
  high?: number
  valve?: { drainId: string; cfg: Partial<ValveConfig> }
  leakSensor?: boolean
  stale?: number
  shared?: boolean
  source?: Device['source']
  simLeakLpm?: number
}

const TANK_SEEDS: TankSeed[] = [
  { id: 't-tatil', name: 'Prototype tank (Tatil)', buildingId: 'b-tatil', ownerId: 'u-admin', capacityL: 17034, pct: 71, catchmentM2: 320, usageLpm: 4, shared: true, leakSensor: true, valve: { drainId: 'd-tat', cfg: { minRetainedL: 5000, highTriggerL: 14500, maxReleaseLpm: 70 } } },
  { id: 't-sq1', name: 'South Quay Tank 1', buildingId: 'b-sq1', ownerId: 'u-kezia', capacityL: 17034, pct: 92, catchmentM2: 420, usageLpm: 6, valve: { drainId: 'd-sq1', cfg: { minRetainedL: 6000, highTriggerL: 15000, maxReleaseLpm: 80 } } },
  { id: 't-sq2', name: 'South Quay Tank 2', buildingId: 'b-sq1', ownerId: 'u-kezia', capacityL: 17034, pct: 55, catchmentM2: 420, usageLpm: 6, valve: { drainId: 'd-sq2', cfg: { minRetainedL: 6000, highTriggerL: 15000, maxReleaseLpm: 80 } } },
  { id: 't-sq3', name: 'South Quay Tank 3', buildingId: 'b-sq1', ownerId: 'u-kezia', capacityL: 17034, pct: 86, catchmentM2: 300, usageLpm: 3 },
  { id: 't-wr1', name: 'Wrightson Rd Tank 1', buildingId: 'b-wr1', ownerId: 'u-kezia', capacityL: 17034, pct: 94, catchmentM2: 380, usageLpm: 4, valve: { drainId: 'd-wr1', cfg: { minRetainedL: 5000, highTriggerL: 14500, maxReleaseLpm: 70 } } },
  { id: 't-res1a', name: 'Home tank A (1,000 gal)', buildingId: 'b-res1', ownerId: 'u-aaliyah', capacityL: 3785, pct: 64, catchmentM2: 110, usageLpm: 1.2, leakSensor: true, valve: { drainId: 'd-wb1', cfg: { minRetainedL: 1200, highTriggerL: 3300, maxReleaseLpm: 20, windowStart: '06:00', windowEnd: '22:00', drainSuspendCm: 55 } } },
  { id: 't-res1b', name: 'Home tank B (600 gal)', buildingId: 'b-res1', ownerId: 'u-aaliyah', capacityL: 2271, pct: 38, catchmentM2: 60, usageLpm: 0.6, leakSensor: true, simLeakLpm: 2.5 },
  { id: 't-res2', name: 'Backyard tank', buildingId: 'b-res2', ownerId: 'u-marcus', capacityL: 4500, pct: 47, catchmentM2: 90, usageLpm: 1, stale: 3.2 * H },
]

interface DrainSeed {
  id: string
  name: string
  communityId: string
  lat: number
  lng: number
  level: number
  base: number
  blockage?: number
  offline?: number
  basketDaysAgo: number
}

const DRAIN_SEEDS: DrainSeed[] = [
  { id: 'd-tat', name: 'Maraval Rd drain (Tatil)', communityId: 'c-sc', lat: 10.6714, lng: -61.5214, level: 14, base: 10, basketDaysAgo: 5 },
  { id: 'd-sq1', name: 'South Quay @ Broadway', communityId: 'c-sq', lat: 10.6496, lng: -61.5098, level: 22, base: 14, basketDaysAgo: 9 },
  { id: 'd-sq2', name: 'South Quay @ Charlotte St', communityId: 'c-sq', lat: 10.6503, lng: -61.5063, level: 31, base: 18, basketDaysAgo: 12 },
  { id: 'd-wr1', name: 'Wrightson Rd @ Independence Sq', communityId: 'c-sq', lat: 10.6509, lng: -61.5163, level: 72, base: 16, blockage: 52, basketDaysAgo: 41 },
  { id: 'd-wr2', name: 'Wrightson Rd (west)', communityId: 'c-sq', lat: 10.6531, lng: -61.5229, level: 19, base: 12, basketDaysAgo: 8 },
  { id: 'd-is1', name: 'Independence Sq North', communityId: 'c-dt', lat: 10.6524, lng: -61.5122, level: 25, base: 15, offline: 7 * H, basketDaysAgo: 20 },
  { id: 'd-hs1', name: 'Henry St @ Queen St', communityId: 'c-dt', lat: 10.6553, lng: -61.5096, level: 17, base: 11, basketDaysAgo: 3 },
  { id: 'd-wb1', name: 'Tragarete Rd (Woodbrook)', communityId: 'c-wb', lat: 10.6629, lng: -61.5292, level: 12, base: 9, basketDaysAgo: 6 },
]

function genHistory(r: () => number, now: number, points: number, stepMs: number, f: (i: number, frac: number) => number): Reading[] {
  const out: Reading[] = []
  for (let i = 0; i < points; i++) {
    const t = now - (points - 1 - i) * stepMs
    out.push({ t, v: f(i, i / (points - 1)) + (r() - 0.5) * 0.6 })
  }
  return out
}

export interface SeedState {
  communities: Community[]
  users: User[]
  buildings: Building[]
  devices: Device[]
  tanks: Tank[]
  valves: Valve[]
  drains: Drain[]
  leaks: LeakAlert[]
  tasks: MaintenanceTask[]
  reports: CitizenReport[]
  events: CleanupEvent[]
  rewardRules: RewardRule[]
  rewards: Reward[]
  pointsTx: PointsTx[]
  programmes: RebateProgramme[]
  applications: RebateApplication[]
  notifications: AppNotification[]
  audit: AuditEntry[]
  sim: SimSettings
}

export function buildSeed(now = Date.now()): SeedState {
  const r = rng(42)
  const devices: Device[] = []
  const tanks: Tank[] = []
  const valves: Valve[] = []

  for (const s of TANK_SEEDS) {
    const lastSeen = now - (s.stale ?? 20_000)
    const devId = `dev-${s.id}-lvl`
    devices.push({ id: devId, kind: 'tank-level', assetId: s.id, model: s.id === 't-tatil' ? 'Arduino + ultrasonic (prototype)' : 'Ultrasonic level sensor (JSN-SR04T class)', firmware: s.id === 't-tatil' ? 'proto-0.1' : '1.4.2', lastSeen, fault: false, source: s.source ?? 'simulated', simDisconnected: !!s.stale, offlineNotified: !!s.stale, battery: 60 + Math.round(r() * 40), enabled: true })
    if (s.leakSensor) devices.push({ id: `dev-${s.id}-leak`, kind: 'leak', assetId: s.id, model: 'Water leak probe', firmware: '1.0.3', lastSeen: now - 30_000, fault: false, source: 'simulated', enabled: true })
    const end = (s.pct / 100) * s.capacityL
    // 48 h history: steady usage with a rain event ~30 h ago
    const hist = genHistory(r, lastSeen, 96, 30 * 60_000, (_i, f) => {
      const t = f * 48
      const rainBump = t > 14 && t < 20 ? (t - 14) / 6 : t >= 20 ? 1 : 0
      const start = Math.max(0.1, s.pct / 100 - 0.28)
      const pct = start + rainBump * 0.22 + (f > 0.42 ? (f - 0.42) * 0.1 : 0)
      return Math.min(s.capacityL, pct * s.capacityL)
    }).map((x) => ({ t: x.t, v: Math.max(0, Math.min(s.capacityL, x.v * 1)) }))
    hist[hist.length - 1] = { t: lastSeen, v: end }
    let valveId: string | undefined
    if (s.valve) {
      valveId = `v-${s.id}`
      const vdev = `dev-${s.id}-valve`
      devices.push({ id: vdev, kind: 'valve', assetId: valveId, model: 'Motorized true-union ball valve + controller', firmware: s.id === 't-tatil' ? 'proto-0.1' : '2.1.0', lastSeen: now - 15_000, fault: false, source: 'simulated', enabled: true })
      valves.push({
        id: valveId,
        tankId: s.id,
        drainId: s.valve.drainId,
        deviceId: vdev,
        state: 'closed',
        stateSince: now - 5 * H,
        mode: 'auto',
        config: baseValve(s.valve.cfg),
        currentReleaseLpm: 0,
        lastOperationAt: now - 5 * H,
        lastOperationBy: 'auto-policy',
        log: [
          { id: `vl-${s.id}-1`, t: now - 7 * H, action: 'open', mode: 'auto', by: 'auto-policy', reason: 'Tank above trigger, downstream drain clear' },
          { id: `vl-${s.id}-2`, t: now - 5 * H, action: 'close', mode: 'auto', by: 'auto-policy', reason: 'Reached minimum retained volume' },
        ],
        simFault: false,
      })
    }
    tanks.push({
      id: s.id,
      name: s.name,
      buildingId: s.buildingId,
      ownerId: s.ownerId,
      capacityL: s.capacityL,
      volumeL: end,
      highThresholdPct: s.high ?? 90,
      lowThresholdPct: 15,
      levelDeviceId: devId,
      leakDeviceId: s.leakSensor ? `dev-${s.id}-leak` : undefined,
      valveId,
      catchmentM2: s.catchmentM2,
      history: hist,
      lastReadingAt: lastSeen,
      quality: 'ok',
      usageLpm: s.usageLpm,
      simLeakLpm: s.simLeakLpm ?? 0,
      leakSuspicionCount: 0,
      collectedL: Math.round(s.capacityL * 0.9),
      usedL: Math.round(s.capacityL * 0.31),
      releasedL: s.valve ? Math.round(s.capacityL * 0.22) : 0,
      shared: s.shared,
      alertState: s.pct >= 98 ? 'critical' : s.pct >= (s.high ?? 90) ? 'high' : 'none',
    })
  }

  const drains: Drain[] = DRAIN_SEEDS.map((s) => {
    const lastSeen = now - (s.offline ?? 25_000)
    const devId = `dev-${s.id}`
    devices.push({ id: devId, kind: 'drain-level', assetId: s.id, model: s.id === 'd-tat' ? 'Arduino + ultrasonic (prototype)' : 'Radar level sensor', firmware: s.id === 'd-tat' ? 'proto-0.1' : '3.0.1', lastSeen, fault: false, source: 'simulated', simDisconnected: !!s.offline, offlineNotified: !!s.offline, battery: 50 + Math.round(r() * 50), enabled: true })
    const hist = genHistory(r, lastSeen, 96, 30 * 60_000, (_i, f) => {
      const t = f * 48
      const storm = t > 14 && t < 22 ? Math.sin(((t - 14) / 8) * Math.PI) * 38 : 0
      const ramp = s.blockage ? Math.max(0, (f - 0.7) / 0.3) * (s.level - s.base) : 0
      return s.base + storm + ramp
    })
    hist[hist.length - 1] = { t: lastSeen, v: s.level }
    return {
      id: s.id,
      name: s.name,
      communityId: s.communityId,
      lat: s.lat,
      lng: s.lng,
      rangeCm: 120,
      levelCm: s.level,
      elevatedCm: 60,
      criticalCm: 90,
      maxRiseCmPerMin: 1.5,
      deviceId: devId,
      history: hist,
      lastReadingAt: lastSeen,
      basketLastCleaned: now - s.basketDaysAgo * D,
      basketCleanIntervalDays: 30,
      inspections: [
        { t: now - s.basketDaysAgo * D, by: 'u-devon', note: 'Basket emptied, mesh intact', kind: 'basket-clean' },
        { t: now - (s.basketDaysAgo + 30) * D, by: 'u-devon', note: 'Routine inspection – no defects', kind: 'inspection' },
      ],
      simBlockageCm: s.blockage ?? 0,
      simBaseCm: s.base,
      alertState: s.level >= 90 ? 'critical' : s.level >= 60 ? 'elevated' : 'none',
      blockageConfirmed: false,
    }
  })

  const leaks: LeakAlert[] = [
    {
      id: 'lk-1',
      tankId: 't-res1b',
      method: 'level-discrepancy',
      severity: 'medium',
      status: 'suspected',
      detectedAt: now - 2 * H,
      evidence: 'Level fell 290 L more than recorded usage over 2 h with valve closed and no rain (≈2.4 L/min unexplained).',
      timeline: [{ t: now - 2 * H, by: 'leak-detector', action: 'Suspected leak raised', note: 'Unexplained level drop rule' }],
    },
    {
      id: 'lk-0',
      tankId: 't-sq3',
      method: 'leak-sensor',
      severity: 'low',
      status: 'resolved',
      detectedAt: now - 9 * D,
      evidence: 'Leak probe at tank base reported water for 6 min.',
      timeline: [
        { t: now - 9 * D, by: 'leak-detector', action: 'Suspected leak raised' },
        { t: now - 9 * D + H, by: 'u-kezia', action: 'Acknowledged' },
        { t: now - 8 * D, by: 'u-devon', action: 'Inspection', note: 'Loose union fitting at outlet' },
        { t: now - 8 * D + 2 * H, by: 'u-devon', action: 'Confirmed' },
        { t: now - 8 * D + 3 * H, by: 'u-devon', action: 'Resolved', note: 'Fitting re-seated and tested' },
      ],
    },
  ]

  const tasks: MaintenanceTask[] = [
    { id: 'mt-1', title: 'Clear drain basket – overdue (41 days)', assetType: 'drain', assetId: 'd-wr1', assigneeId: 'u-devon', status: 'assigned', priority: 'high', createdAt: now - 6 * H, dueAt: now + 18 * H, source: 'Basket schedule + elevated level', notes: [{ t: now - 6 * H, by: 'u-admin', action: 'Assigned to Devon Ramdial' }] },
    { id: 'mt-2', title: 'Tank level sensor not reporting', assetType: 'device', assetId: 'dev-t-res2-lvl', status: 'open', priority: 'medium', createdAt: now - 2 * H, source: 'Device offline > 3 h', notes: [] },
    { id: 'mt-3', title: 'Restore drain sensor (Independence Sq North)', assetType: 'device', assetId: 'dev-d-is1', assigneeId: 'u-devon', status: 'in_progress', priority: 'medium', createdAt: now - 7 * H, source: 'Device offline', notes: [{ t: now - 3 * H, by: 'u-devon', action: 'On site', note: 'Suspect flat battery' }] },
    { id: 'mt-4', title: 'Quarterly valve function test', assetType: 'valve', assetId: 'v-t-sq1', status: 'done', priority: 'low', createdAt: now - 12 * D, source: 'Schedule', notes: [{ t: now - 11 * D, by: 'u-devon', action: 'Completed', note: 'Open/close cycle OK, 12 s actuation' }] },
  ]

  const reports: CitizenReport[] = [
    {
      id: 'rp-1',
      category: 'blocked-drain',
      description: 'Drain grate packed with plastic bottles and leaves – water ponding at the corner after light rain.',
      lat: 10.6511,
      lng: -61.5161,
      locationText: 'Wrightson Rd near Independence Sq (approx.)',
      photoName: 'drain-wrightson.jpg',
      createdAt: now - 5 * H,
      reporterId: 'u-aaliyah',
      status: 'under_review',
      history: [
        { t: now - 5 * H, by: 'u-aaliyah', action: 'Submitted' },
        { t: now - 4 * H, by: 'u-devon', action: 'Under review' },
      ],
    },
    {
      id: 'rp-2',
      category: 'litter',
      description: 'Bags of household garbage dumped beside the drain inlet.',
      lat: 10.6499,
      lng: -61.5072,
      locationText: 'South Quay near Charlotte St (approx.)',
      createdAt: now - 3 * D,
      reporterId: 'u-marcus',
      status: 'resolved',
      assignedTeam: 'Drainage crew A (demo)',
      resolutionNotes: 'Waste removed; area added to weekly patrol.',
      history: [
        { t: now - 3 * D, by: 'u-marcus', action: 'Submitted' },
        { t: now - 3 * D + 2 * H, by: 'u-devon', action: 'Verified' },
        { t: now - 3 * D + 3 * H, by: 'u-devon', action: 'Assigned', note: 'Drainage crew A (demo)' },
        { t: now - 2 * D, by: 'u-devon', action: 'Resolved', note: 'Waste removed' },
      ],
    },
    {
      id: 'rp-3',
      category: 'flooded-road',
      description: 'Ankle-deep water across both lanes during the afternoon shower.',
      lat: 10.6528,
      lng: -61.5119,
      locationText: 'Independence Square North (approx.)',
      createdAt: now - 1 * D,
      reporterId: 'u-kezia',
      status: 'verified',
      history: [
        { t: now - 1 * D, by: 'u-kezia', action: 'Submitted' },
        { t: now - 1 * D + H, by: 'u-devon', action: 'Verified', note: 'Matches drain sensor history' },
      ],
    },
  ]

  const nextSat = (() => {
    const d = new Date(now)
    const add = (6 - d.getDay() + 7) % 7 || 7
    d.setDate(d.getDate() + add)
    d.setHours(7, 0, 0, 0)
    return d.getTime()
  })()

  const events: CleanupEvent[] = [
    {
      id: 'ev-today',
      title: 'Maraval Road drain-basket blitz (demo day)',
      communityId: 'c-sc',
      locationName: 'Outside the Tatil Building, Maraval Road',
      lat: 10.6716,
      lng: -61.5212,
      start: now - 1 * H,
      end: now + 3 * H,
      organizer: 'Department of Dry Affairs',
      equipment: ['Gloves (provided)', 'Closed-toe shoes', 'Water bottle'],
      capacity: 30,
      points: 100,
      registrations: [
        { userId: 'u-marcus', at: now - 2 * D },
        { userId: 'u-kezia', at: now - 2 * D },
      ],
      checkins: [{ userId: 'u-kezia', at: now - 40 * 60_000 }],
      verified: [],
      completed: false,
    },
    {
      id: 'ev-sat',
      title: 'South Quay Corridor Cleanup',
      communityId: 'c-sq',
      locationName: 'South Quay at Broadway',
      lat: 10.6497,
      lng: -61.5094,
      start: nextSat,
      end: nextSat + 4 * H,
      organizer: 'Department of Dry Affairs',
      equipment: ['Gloves', 'Hat & sunscreen', 'Closed-toe shoes'],
      capacity: 60,
      points: 100,
      registrations: [
        { userId: 'u-aaliyah', at: now - 1 * D },
        { userId: 'u-marcus', at: now - 1 * D },
      ],
      checkins: [],
      verified: [],
      completed: false,
    },
    {
      id: 'ev-past',
      title: 'Woodbrook Drains Day',
      communityId: 'c-wb',
      locationName: 'Tragarete Rd, Woodbrook',
      lat: 10.6629,
      lng: -61.5292,
      start: now - 24 * D,
      end: now - 24 * D + 4 * H,
      organizer: 'Department of Dry Affairs',
      equipment: ['Gloves'],
      capacity: 40,
      points: 100,
      registrations: [
        { userId: 'u-aaliyah', at: now - 30 * D },
        { userId: 'u-marcus', at: now - 30 * D },
      ],
      checkins: [
        { userId: 'u-aaliyah', at: now - 24 * D },
        { userId: 'u-marcus', at: now - 24 * D },
      ],
      verified: [
        { userId: 'u-aaliyah', at: now - 24 * D + 5 * H, by: 'u-devon' },
        { userId: 'u-marcus', at: now - 24 * D + 5 * H, by: 'u-devon' },
      ],
      wasteKg: 186,
      completed: true,
      summary: '27 volunteers cleared 14 drain inlets and collected 186 kg of waste (mostly plastic bottles and food containers).',
    },
  ]

  const rewardRules: RewardRule[] = [
    { id: 'rr-cleanup', activity: 'cleanup', label: 'Verified cleanup participation', points: 100, active: true },
    { id: 'rr-report', activity: 'verified-report', label: 'Report verified by staff', points: 25, active: true },
    { id: 'rr-campaign', activity: 'campaign', label: 'Approved environmental campaign', points: 50, active: true },
    { id: 'rr-conserve', activity: 'conservation', label: 'Water-conservation activity', points: 40, active: true },
  ]

  const rewards: Reward[] = [
    { id: 'rw-shout', name: 'Shout-out on the IFRS community board', sponsor: 'IFRS', cost: 50, stock: 999, conditions: 'Only with your consent; first name and community only.', monetary: false },
    { id: 'rw-voucher', name: 'Food voucher from a partner vendor (example)', sponsor: 'Partner business – to be confirmed', cost: 150, stock: 20, expiresAt: now + 60 * D, conditions: 'Example reward for the demo. Valid 30 days from redemption.', monetary: true },
    { id: 'rw-shirt', name: '"Channel the Rain" cleanup T-shirt', sponsor: 'Department of Dry Affairs', cost: 300, stock: 12, conditions: 'Collect at the next cleanup event.', monetary: false },
    { id: 'rw-credit', name: 'Water-bill credit (TT$50)', sponsor: 'Requires a funded programme partner', cost: 500, stock: 0, conditions: 'Not available: no funded water-credit programme exists yet. Shown to illustrate a future option.', monetary: true },
  ]

  const pointsTx: PointsTx[] = [
    { id: 'px-1', userId: 'u-aaliyah', t: now - 24 * D + 5 * H, delta: 100, kind: 'earn', ref: 'cleanup:ev-past', note: 'Verified: Woodbrook Drains Day' },
    { id: 'px-2', userId: 'u-marcus', t: now - 24 * D + 5 * H, delta: 100, kind: 'earn', ref: 'cleanup:ev-past', note: 'Verified: Woodbrook Drains Day' },
    { id: 'px-3', userId: 'u-marcus', t: now - 3 * D + 2 * H, delta: 25, kind: 'earn', ref: 'report:rp-2', note: 'Report verified: litter at South Quay' },
    { id: 'px-4', userId: 'u-kezia', t: now - 1 * D + H, delta: 25, kind: 'earn', ref: 'report:rp-3', note: 'Report verified: flooded road' },
    { id: 'px-5', userId: 'u-aaliyah', t: now - 10 * D, delta: 40, kind: 'earn', ref: 'conservation:aaliyah-audit', note: 'Completed home water-use audit' },
    { id: 'px-6', userId: 'u-aaliyah', t: now - 9 * D, delta: -50, kind: 'redeem', ref: 'redeem:rw-shout:px-6', note: 'Redeemed: Shout-out on the IFRS community board' },
  ]

  const programmes: RebateProgramme[] = [
    {
      id: 'rb-pilot',
      name: 'Rainwater Installation Rebate – PILOT CONCEPT',
      sponsor: 'Sponsor not yet confirmed (proposal only)',
      model: 'fixed-install',
      fixedAmountTTD: 1500,
      equipmentPct: 30,
      equipmentCapTTD: 3000,
      perKLSavedTTD: 6,
      fundingCapTTD: 150000,
      startDate: now - 20 * D,
      endDate: now + 345 * D,
      active: true,
      rules: [
        { id: 'er-1', kind: 'has-registered-tank', label: 'At least one registered rainwater tank', enabled: true },
        { id: 'er-2', kind: 'min-capacity', label: 'Total storage of at least 2,000 L', param: 2000, enabled: true },
        { id: 'er-3', kind: 'has-sensor', label: 'Tank fitted with an IFRS level sensor', enabled: true },
        { id: 'er-4', kind: 'install-verified', label: 'Installation inspected by IFRS staff', enabled: true },
        { id: 'er-5', kind: 'in-pilot-area', label: 'Property inside a pilot community', enabled: false },
      ],
    },
  ]

  const applications: RebateApplication[] = [
    {
      id: 'ra-1',
      userId: 'u-aaliyah',
      programmeId: 'rb-pilot',
      status: 'under_review',
      tankIds: ['t-res1a', 't-res1b'],
      propertyRef: 'WB-•••-214',
      accountRefLast4: '4471',
      equipmentCostTTD: 9800,
      documents: ['tank-receipt.pdf', 'installation-photo.jpg'],
      createdAt: now - 6 * D,
      history: [
        { t: now - 6 * D, by: 'u-aaliyah', action: 'Submitted' },
        { t: now - 4 * D, by: 'u-admin', action: 'Under review', note: 'Awaiting installation inspection' },
      ],
    },
    {
      id: 'ra-2',
      userId: 'u-marcus',
      programmeId: 'rb-pilot',
      status: 'approved',
      tankIds: ['t-res2'],
      propertyRef: 'PS-•••-077',
      accountRefLast4: '1180',
      equipmentCostTTD: 7200,
      documents: ['receipt.pdf'],
      createdAt: now - 15 * D,
      history: [
        { t: now - 15 * D, by: 'u-marcus', action: 'Submitted' },
        { t: now - 13 * D, by: 'u-admin', action: 'Under review' },
        { t: now - 10 * D, by: 'u-admin', action: 'Approved', note: 'All conditions met' },
      ],
      decision: { by: 'u-admin', t: now - 10 * D, amountTTD: 1500, reason: 'All eligibility conditions met; installation inspected.' },
    },
  ]

  const notifications: AppNotification[] = [
    { id: 'n-1', t: now - 2 * H, kind: 'leak', severity: 'warning', title: 'Possible leak: Home tank B', body: 'Level is dropping faster than recorded usage. Please check the tank and fittings.', link: '/leaks', userIds: ['u-aaliyah'], roles: ['maintenance', 'admin'], readBy: [], simulatedChannels: ['in-app', 'sms (simulated)'] },
    { id: 'n-2', t: now - 3 * H, kind: 'device', severity: 'warning', title: 'Sensor offline: Backyard tank', body: 'No readings for over 3 hours. The last value is shown as outdated.', link: '/tanks/t-res2', userIds: ['u-marcus'], roles: ['maintenance', 'admin'], readBy: [], simulatedChannels: ['in-app'] },
    { id: 'n-3', t: now - 4 * H, kind: 'drain', severity: 'critical', title: 'Elevated drain: Wrightson Rd @ Independence Sq', body: 'Water level above the elevated threshold with little rain – possible blockage (unconfirmed).', link: '/drains/d-wr1', roles: ['maintenance', 'admin'], userIds: ['u-kezia'], readBy: [], simulatedChannels: ['in-app', 'email (simulated)'] },
    { id: 'n-4', t: now - 4 * H, kind: 'community', severity: 'info', title: 'Your report is under review', body: 'Blocked drain on Wrightson Rd – a crew member is reviewing it.', link: '/community', userIds: ['u-aaliyah'], readBy: [], simulatedChannels: ['in-app'] },
    { id: 'n-5', t: now - 1 * D, kind: 'community', severity: 'info', title: 'Cleanup this Saturday', body: 'South Quay Corridor Cleanup – 7:00 AM. Gloves provided.', link: '/community', userIds: ['u-aaliyah', 'u-marcus'], readBy: [], simulatedChannels: ['in-app'] },
  ]

  const audit: AuditEntry[] = [
    { id: 'a-1', t: now - 10 * D, actorId: 'u-admin', action: 'rebate.decision', target: 'ra-2', detail: 'Approved TT$1,500' },
    { id: 'a-2', t: now - 6 * H, actorId: 'u-admin', action: 'task.assign', target: 'mt-1', detail: 'Assigned to u-devon' },
    { id: 'a-3', t: now - 5 * H, actorId: 'auto-policy', action: 'valve.close', target: 'v-t-sq1', detail: 'Reached minimum retained volume' },
  ]

  const sim: SimSettings = {
    running: true,
    rain: 1,
    minutesPerTick: 5,
    tickMs: 3000,
    emergencyStop: false,
    dataSource: 'simulated',
    liveUrl: '',
    livePollSec: 10,
    liveDeviceId: 'dev-t-tatil-lvl',
  }

  return {
    communities: COMMUNITIES,
    users: USERS,
    buildings: BUILDINGS,
    devices,
    tanks,
    valves,
    drains,
    leaks,
    tasks,
    reports,
    events,
    rewardRules,
    rewards,
    pointsTx,
    programmes,
    applications,
    notifications,
    audit,
    sim,
  }
}
