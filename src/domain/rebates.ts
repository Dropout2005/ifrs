import type { Building, Device, EligibilityRule, RebateApplication, RebateProgramme, RebateStatus, Role, Tank } from './types'

export const REBATE_FLOW: Record<RebateStatus, RebateStatus[]> = {
  draft: ['submitted'],
  submitted: ['under_review'],
  under_review: ['info_required', 'approved', 'rejected'],
  info_required: ['submitted'],
  approved: ['credited'],
  rejected: ['closed'],
  credited: ['closed'],
  closed: [],
}

export const REBATE_LABEL: Record<RebateStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  info_required: 'Additional information required',
  approved: 'Approved',
  rejected: 'Rejected',
  credited: 'Credit issued',
  closed: 'Closed',
}

/** Which role may perform each transition (applicant = the resident who owns the application). */
export function canTransitionRebate(from: RebateStatus, to: RebateStatus, role: Role, isApplicant: boolean): boolean {
  if (!REBATE_FLOW[from].includes(to)) return false
  const applicantMoves = (from === 'draft' && to === 'submitted') || (from === 'info_required' && to === 'submitted')
  if (applicantMoves) return isApplicant
  // Reviewer moves – never by the applicant themselves.
  if (isApplicant) return false
  return role === 'admin' || role === 'maintenance'
}

export interface EligibilityContext {
  tanks: Tank[]
  devices: Device[]
  buildings: Building[]
  pilotCommunityIds: string[]
  installVerified: boolean
}

export interface EligibilityResult {
  rule: EligibilityRule
  pass: boolean
  detail: string
}

export function checkEligibility(p: RebateProgramme, ctx: EligibilityContext): EligibilityResult[] {
  return p.rules
    .filter((r) => r.enabled)
    .map((rule) => {
      switch (rule.kind) {
        case 'has-registered-tank':
          return { rule, pass: ctx.tanks.length > 0, detail: `${ctx.tanks.length} tank(s) registered` }
        case 'min-capacity': {
          const total = ctx.tanks.reduce((s, t) => s + t.capacityL, 0)
          return { rule, pass: total >= (rule.param ?? 0), detail: `${total.toLocaleString()} L total vs ${(rule.param ?? 0).toLocaleString()} L required` }
        }
        case 'has-sensor': {
          const withSensor = ctx.tanks.filter((t) => ctx.devices.some((d) => d.id === t.levelDeviceId && d.enabled))
          return { rule, pass: withSensor.length > 0, detail: `${withSensor.length} tank(s) with a level sensor` }
        }
        case 'install-verified':
          return { rule, pass: ctx.installVerified, detail: ctx.installVerified ? 'Installation inspected by staff' : 'Awaiting staff inspection of installation' }
        case 'in-pilot-area': {
          const b = ctx.buildings.filter((b) => ctx.tanks.some((t) => t.buildingId === b.id))
          const ok = b.some((x) => ctx.pilotCommunityIds.includes(x.communityId))
          return { rule, pass: ok, detail: ok ? 'Property is in a pilot community' : 'Property is outside the pilot area' }
        }
      }
    })
}

export interface RebateEstimate {
  amountTTD: number
  formula: string
  assumptions: string[]
  basis: 'estimate' | 'verified'
}

/**
 * Estimate only. Rainwater collected is NOT treated as mains water saved;
 * performance incentives require verified meter-based savings against a baseline.
 */
export function estimateRebate(
  p: RebateProgramme,
  app: Pick<RebateApplication, 'equipmentCostTTD'>,
  verifiedSavingsKL: number | null,
): RebateEstimate {
  switch (p.model) {
    case 'fixed-install':
      return {
        amountTTD: p.fixedAmountTTD,
        formula: `Fixed installation rebate = TT$${p.fixedAmountTTD}`,
        assumptions: ['Paid once per eligible property', 'Subject to programme funding and inspection'],
        basis: 'estimate',
      }
    case 'equipment': {
      const raw = (app.equipmentCostTTD * p.equipmentPct) / 100
      const amt = Math.min(raw, p.equipmentCapTTD)
      return {
        amountTTD: Math.round(amt),
        formula: `min(${p.equipmentPct}% × TT$${app.equipmentCostTTD.toLocaleString()}, cap TT$${p.equipmentCapTTD.toLocaleString()})`,
        assumptions: ['Based on receipts for approved equipment', 'Labour excluded unless programme states otherwise'],
        basis: 'estimate',
      }
    }
    case 'performance':
      if (verifiedSavingsKL === null) {
        return {
          amountTTD: 0,
          formula: `TT$${p.perKLSavedTTD} × verified kL saved`,
          assumptions: ['Requires a 12-month mains-meter baseline and utility meter data', 'No verified savings yet – amount cannot be estimated'],
          basis: 'estimate',
        }
      }
      return {
        amountTTD: Math.round(verifiedSavingsKL * p.perKLSavedTTD),
        formula: `TT$${p.perKLSavedTTD} × ${verifiedSavingsKL.toFixed(1)} kL verified`,
        assumptions: ['Savings measured against meter baseline'],
        basis: 'verified',
      }
  }
}

export function fundingCommitted(apps: RebateApplication[], programmeId: string): number {
  return apps
    .filter((a) => a.programmeId === programmeId && (a.status === 'approved' || a.status === 'credited' || a.status === 'closed') && a.decision)
    .reduce((s, a) => s + (a.decision?.amountTTD ?? 0), 0)
}
