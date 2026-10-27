// Core domain types for IFRS. All timestamps are epoch milliseconds.
// Units are stated in field names (L = litres, Cm = centimetres, Lpm = litres per minute, TTD = TT dollars).

export type Role = 'resident' | 'maintenance' | 'admin'

export type Status = 'normal' | 'monitor' | 'warning' | 'critical' | 'offline' | 'inspect'

export interface Community {
  id: string
  name: string
  pilot: boolean
}

export interface User {
  id: string
  name: string
  role: Role
  email: string
  communityId: string
  title?: string
  publicRecognition: boolean
  notificationPrefs: {
    tank: boolean
    leak: boolean
    drain: boolean
    device: boolean
    maintenance: boolean
    community: boolean
    rewards: boolean
    rebates: boolean
    channelEmail: boolean
    channelSms: boolean
  }
  accessibility: { largeText: boolean; reduceMotion: boolean; highContrast: boolean }
  disabled?: boolean
}

export interface Building {
  id: string
  name: string
  communityId: string
  ownerId?: string
  kind: 'residential' | 'commercial' | 'public'
  address: string
  lat: number
  lng: number
  /** If false, exact location is never shown on public maps. */
  publicLocation: boolean
  isPrototypeSite?: boolean
  installVerified?: boolean
  note?: string
}

export type DeviceKind = 'tank-level' | 'drain-level' | 'leak' | 'flow' | 'valve'
export type DeviceSource = 'simulated' | 'live' | 'awaiting-hardware'

export interface Device {
  id: string
  kind: DeviceKind
  assetId: string
  model: string
  firmware: string
  lastSeen: number
  /** Self-reported fault flag. Online/offline is derived from lastSeen. */
  fault: boolean
  source: DeviceSource
  /** Simulation only: when true the simulator stops producing readings (disconnected). */
  simDisconnected?: boolean
  battery?: number
  enabled: boolean
  /** Leak probes only: currently detecting water. */
  wet?: boolean
  offlineNotified?: boolean
}

export interface Reading {
  t: number
  v: number
}

export type ReadingQuality = 'ok' | 'overflow' | 'invalid'

export interface Tank {
  id: string
  name: string
  buildingId: string
  ownerId: string
  capacityL: number
  volumeL: number
  highThresholdPct: number
  lowThresholdPct: number
  levelDeviceId: string
  leakDeviceId?: string
  valveId?: string
  catchmentM2: number
  history: Reading[]
  lastReadingAt: number
  quality: ReadingQuality
  /** Typical non-potable usage (toilet flushing, washing) – simulation input. */
  usageLpm: number
  /** Hidden simulated leak; the detector must infer it from data. */
  simLeakLpm: number
  /** Consecutive ticks where measured drop exceeded expected drop. */
  leakSuspicionCount: number
  collectedL: number
  usedL: number
  releasedL: number
  /** Showcase tank visible to every signed-in role (e.g. the Tatil prototype). */
  shared?: boolean
  alertState?: 'none' | 'high' | 'critical'
}

export type ValveState = 'open' | 'closed' | 'opening' | 'closing' | 'fault'

export interface ValveConfig {
  minRetainedL: number
  highTriggerL: number
  maxReleaseLpm: number
  windowStart: string // "HH:MM"
  windowEnd: string // "HH:MM"
  autoEnabled: boolean
  manualOverrideRoles: Role[]
  /** Suspend release when downstream drain is at/above this level. */
  drainSuspendCm: number
  /** Suspend release when downstream drain rises faster than this. */
  maxDrainRiseCmPerMin: number
  staleAfterSec: number
}

export interface ValveLogEntry {
  id: string
  t: number
  action: 'open' | 'close' | 'hold' | 'fault' | 'estop' | 'config'
  mode: 'auto' | 'manual'
  by: string
  reason: string
}

export interface Valve {
  id: string
  tankId: string
  drainId?: string
  deviceId: string
  state: ValveState
  stateSince: number
  mode: 'auto' | 'manual'
  config: ValveConfig
  currentReleaseLpm: number
  lastOperationAt: number
  lastOperationBy: string
  lastDecision?: { t: number; action: 'open' | 'close' | 'hold'; summary: string; rules: RuleResult[] }
  log: ValveLogEntry[]
  simFault: boolean
}

export interface RuleResult {
  id: string
  label: string
  pass: boolean
  detail: string
}

export interface Inspection {
  t: number
  by: string
  note: string
  kind: 'inspection' | 'basket-clean' | 'repair'
}

export interface Drain {
  id: string
  name: string
  communityId: string
  lat: number
  lng: number
  rangeCm: number
  levelCm: number
  elevatedCm: number
  criticalCm: number
  maxRiseCmPerMin: number
  deviceId: string
  history: Reading[]
  lastReadingAt: number
  basketLastCleaned: number
  basketCleanIntervalDays: number
  inspections: Inspection[]
  /** Simulation: extra level from a blockage (not visible to users). */
  simBlockageCm: number
  /** Simulation: dry-weather baseline level. */
  simBaseCm: number
  blockageConfirmed: boolean
  alertState?: 'none' | 'elevated' | 'critical'
}

export type LeakStatus =
  | 'suspected'
  | 'acknowledged'
  | 'inspecting'
  | 'confirmed'
  | 'escalated'
  | 'false_alarm'
  | 'resolved'

export type LeakMethod = 'leak-sensor' | 'level-discrepancy' | 'unexpected-flow' | 'usage-discrepancy'

export interface TimelineEntry {
  t: number
  by: string
  action: string
  note?: string
}

export interface LeakAlert {
  id: string
  tankId: string
  method: LeakMethod
  severity: 'low' | 'medium' | 'high'
  status: LeakStatus
  detectedAt: number
  evidence: string
  timeline: TimelineEntry[]
  maintenanceTaskId?: string
}

export type TaskStatus = 'open' | 'assigned' | 'in_progress' | 'done' | 'cancelled'

export interface MaintenanceTask {
  id: string
  title: string
  assetType: 'tank' | 'drain' | 'valve' | 'report' | 'device'
  assetId: string
  assigneeId?: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high'
  createdAt: number
  dueAt?: number
  notes: TimelineEntry[]
  source: string
}

export type ReportCategory =
  | 'flooded-road'
  | 'blocked-drain'
  | 'overflowing-drain'
  | 'litter'
  | 'basket-full'
  | 'public-leak'

export type ReportStatus =
  | 'submitted'
  | 'under_review'
  | 'verified'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'duplicate'
  | 'unable_to_verify'

export interface CitizenReport {
  id: string
  category: ReportCategory
  description: string
  lat: number
  lng: number
  locationText: string
  photoName?: string
  createdAt: number
  reporterId: string
  status: ReportStatus
  assignedTeam?: string
  resolutionNotes?: string
  history: TimelineEntry[]
  possibleDuplicateOf?: string
}

export interface CleanupEvent {
  id: string
  title: string
  communityId: string
  locationName: string
  lat: number
  lng: number
  start: number
  end: number
  organizer: string
  equipment: string[]
  capacity: number
  points: number
  registrations: { userId: string; at: number }[]
  checkins: { userId: string; at: number; evidence?: string }[]
  verified: { userId: string; at: number; by: string }[]
  wasteKg?: number
  completed: boolean
  summary?: string
}

export interface RewardRule {
  id: string
  activity: 'cleanup' | 'verified-report' | 'campaign' | 'conservation'
  label: string
  points: number
  active: boolean
}

export interface Reward {
  id: string
  name: string
  sponsor: string
  cost: number
  stock: number
  expiresAt?: number
  conditions: string
  monetary: boolean
}

export interface PointsTx {
  id: string
  userId: string
  t: number
  delta: number
  kind: 'earn' | 'redeem' | 'reversal'
  /** Idempotency key – an activity can only ever be rewarded once. */
  ref: string
  note: string
}

export type RebateStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'info_required'
  | 'approved'
  | 'rejected'
  | 'credited'
  | 'closed'

export type EligibilityKind =
  | 'has-registered-tank'
  | 'min-capacity'
  | 'has-sensor'
  | 'install-verified'
  | 'in-pilot-area'

export interface EligibilityRule {
  id: string
  kind: EligibilityKind
  label: string
  param?: number
  enabled: boolean
}

export type RebateModel = 'fixed-install' | 'equipment' | 'performance'

export interface RebateProgramme {
  id: string
  name: string
  sponsor: string
  model: RebateModel
  fixedAmountTTD: number
  equipmentPct: number
  equipmentCapTTD: number
  perKLSavedTTD: number
  fundingCapTTD: number
  startDate: number
  endDate: number
  rules: EligibilityRule[]
  active: boolean
}

export interface RebateApplication {
  id: string
  userId: string
  programmeId: string
  status: RebateStatus
  tankIds: string[]
  propertyRef: string
  accountRefLast4: string
  equipmentCostTTD: number
  documents: string[]
  createdAt: number
  history: TimelineEntry[]
  decision?: { by: string; t: number; amountTTD: number; reason: string }
  infoRequest?: string
}

export type NotificationKind =
  | 'tank'
  | 'leak'
  | 'drain'
  | 'device'
  | 'maintenance'
  | 'community'
  | 'rewards'
  | 'rebates'

export interface AppNotification {
  id: string
  t: number
  kind: NotificationKind
  severity: 'info' | 'warning' | 'critical' | 'success'
  title: string
  body: string
  link?: string
  /** Recipients: explicit users and/or roles. */
  userIds?: string[]
  roles?: Role[]
  readBy: string[]
  /** Channels that would be used if providers were configured (simulated). */
  simulatedChannels: string[]
}

export interface AuditEntry {
  id: string
  t: number
  actorId: string
  action: string
  target: string
  detail: string
}

export type RainLevel = 0 | 1 | 2 | 3

export interface SimSettings {
  running: boolean
  rain: RainLevel
  /** Simulated minutes per real tick. */
  minutesPerTick: number
  tickMs: number
  emergencyStop: boolean
  dataSource: 'simulated' | 'live'
  liveUrl: string
  livePollSec: number
  liveDeviceId: string
  liveLastStatus?: string
}
