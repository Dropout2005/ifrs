import type { Role, Tank, User, Valve } from './types'

/**
 * Role-based access control.
 * NOTE: in this static demo checks run in the browser. A production deployment must
 * repeat every check server-side; the browser is never trusted with real valve commands.
 */
export type Permission =
  | 'tank:view-all'
  | 'tank:add'
  | 'valve:configure-own'
  | 'valve:configure-any'
  | 'valve:manual-any'
  | 'estop'
  | 'drain:view'
  | 'drain:inspect'
  | 'leak:workflow'
  | 'report:create'
  | 'report:verify'
  | 'maintenance:view'
  | 'maintenance:manage'
  | 'cleanup:register'
  | 'cleanup:organize'
  | 'rewards:redeem'
  | 'rewards:manage'
  | 'rebate:apply'
  | 'rebate:review'
  | 'rebate:configure'
  | 'admin:users'
  | 'admin:devices'
  | 'admin:thresholds'
  | 'audit:view'
  | 'sim:control'

const MATRIX: Record<Role, Permission[]> = {
  resident: ['tank:add', 'valve:configure-own', 'drain:view', 'report:create', 'cleanup:register', 'rewards:redeem', 'rebate:apply', 'sim:control'],
  maintenance: [
    'tank:view-all',
    'drain:view',
    'drain:inspect',
    'leak:workflow',
    'report:create',
    'report:verify',
    'maintenance:view',
    'maintenance:manage',
    'cleanup:organize',
    'rebate:review',
    'estop',
    'valve:manual-any',
    'sim:control',
  ],
  admin: [
    'tank:view-all',
    'tank:add',
    'valve:configure-any',
    'valve:manual-any',
    'estop',
    'drain:view',
    'drain:inspect',
    'leak:workflow',
    'report:create',
    'report:verify',
    'maintenance:view',
    'maintenance:manage',
    'cleanup:organize',
    'rewards:manage',
    'rebate:review',
    'rebate:configure',
    'admin:users',
    'admin:devices',
    'admin:thresholds',
    'audit:view',
    'sim:control',
  ],
}

export function can(user: User | undefined, p: Permission): boolean {
  if (!user || user.disabled) return false
  return MATRIX[user.role].includes(p)
}

export function canViewTank(user: User | undefined, tank: Tank): boolean {
  if (!user || user.disabled) return false
  return tank.ownerId === user.id || !!tank.shared || can(user, 'tank:view-all')
}

export function canConfigureValve(user: User | undefined, tank: Tank): boolean {
  if (!user || user.disabled) return false
  if (can(user, 'valve:configure-any')) return true
  return can(user, 'valve:configure-own') && tank.ownerId === user.id
}

export function canManualOperate(user: User | undefined, tank: Tank, valve: Valve): boolean {
  if (!user || user.disabled) return false
  if (can(user, 'valve:manual-any')) return true
  return tank.ownerId === user.id && valve.config.manualOverrideRoles.includes(user.role)
}

/** Residents can only see their own leak alerts; staff see all. */
export function canViewLeak(user: User | undefined, tank: Tank | undefined): boolean {
  if (!user || !tank) return false
  return canViewTank(user, tank)
}

/** Nobody may decide on their own rebate application. */
export function canReviewRebate(user: User | undefined, applicantId: string): boolean {
  return can(user, 'rebate:review') && user!.id !== applicantId
}

export const ROLE_LABEL: Record<Role, string> = {
  resident: 'Resident',
  maintenance: 'Maintenance / Municipal',
  admin: 'System Administrator',
}
