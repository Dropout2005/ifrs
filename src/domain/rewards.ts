import type { PointsTx, Reward } from './types'

export function balance(txs: PointsTx[], userId: string): number {
  return txs.filter((t) => t.userId === userId).reduce((s, t) => s + t.delta, 0)
}

export function lifetimeEarned(txs: PointsTx[], userId: string): number {
  return txs.filter((t) => t.userId === userId && t.kind === 'earn').reduce((s, t) => s + t.delta, 0)
}

/** Award points exactly once per activity reference. Returns null if already awarded or invalid. */
export function award(
  txs: PointsTx[],
  p: { userId: string; ref: string; points: number; note: string; now: number; id: string },
): PointsTx | null {
  if (!(p.points > 0)) return null
  if (txs.some((t) => t.ref === p.ref && t.userId === p.userId && t.kind === 'earn')) return null
  return { id: p.id, userId: p.userId, t: p.now, delta: Math.round(p.points), kind: 'earn', ref: p.ref, note: p.note }
}

export type RedeemCheck = { ok: true } | { ok: false; reason: string }

export function checkRedeem(txs: PointsTx[], reward: Reward, userId: string, now: number): RedeemCheck {
  if (reward.stock <= 0) return { ok: false, reason: 'Out of stock' }
  if (reward.expiresAt && reward.expiresAt < now) return { ok: false, reason: 'This reward has expired' }
  const bal = balance(txs, userId)
  if (bal < reward.cost) return { ok: false, reason: `Need ${reward.cost - bal} more points` }
  return { ok: true }
}

export function redeemTx(reward: Reward, userId: string, now: number, id: string): PointsTx {
  return { id, userId, t: now, delta: -reward.cost, kind: 'redeem', ref: `redeem:${reward.id}:${id}`, note: `Redeemed: ${reward.name}` }
}
