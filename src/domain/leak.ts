import type { LeakStatus } from './types'

/**
 * Level-discrepancy leak detection.
 * expectedDelta = collected − used − released (all accounted flows)
 * A drop larger than expected by more than the tolerance, sustained for
 * `ticksRequired` consecutive intervals, raises a *suspected* leak.
 * Single drops never trigger – usage, intentional release and sensor noise are accounted for.
 */
export interface DiscrepancyInput {
  measuredDeltaL: number
  collectedL: number
  usedL: number
  releasedL: number
  toleranceL: number
}

export function unexplainedLossL(i: DiscrepancyInput): number {
  const expected = i.collectedL - i.usedL - i.releasedL
  const loss = expected - i.measuredDeltaL // positive = more water disappeared than explained
  return loss > i.toleranceL ? loss : 0
}

export function nextSuspicionCount(prev: number, unexplainedL: number): number {
  return unexplainedL > 0 ? prev + 1 : Math.max(0, prev - 1)
}

export const LEAK_TICKS_REQUIRED = 4

export function severityFor(lossLpm: number): 'low' | 'medium' | 'high' {
  if (lossLpm >= 8) return 'high'
  if (lossLpm >= 3) return 'medium'
  return 'low'
}

export const LEAK_TRANSITIONS: Record<LeakStatus, LeakStatus[]> = {
  suspected: ['acknowledged', 'false_alarm'],
  acknowledged: ['inspecting', 'false_alarm'],
  inspecting: ['confirmed', 'false_alarm', 'escalated'],
  confirmed: ['escalated', 'resolved'],
  escalated: ['resolved'],
  false_alarm: [],
  resolved: [],
}

export function canTransitionLeak(from: LeakStatus, to: LeakStatus): boolean {
  return LEAK_TRANSITIONS[from].includes(to)
}

export const LEAK_LABEL: Record<LeakStatus, string> = {
  suspected: 'Suspected',
  acknowledged: 'Acknowledged',
  inspecting: 'Inspection in progress',
  confirmed: 'Confirmed',
  escalated: 'Escalated',
  false_alarm: 'False alarm',
  resolved: 'Resolved',
}

export const isLeakOpen = (s: LeakStatus) => s !== 'false_alarm' && s !== 'resolved'
