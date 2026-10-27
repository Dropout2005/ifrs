import { useEffect, useMemo, useState } from 'react'
import { useStore } from './store'
import { canViewTank } from '../domain/rbac'
import { deviceHealth, drainStatus, percentFull, tankStatus } from '../domain/calc'
import type { AppNotification, Drain, Tank, User } from '../domain/types'

export function useNow(ms = 5000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function useMe(): User {
  return useStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0])
}

export function useNameOf() {
  const users = useStore((s) => s.users)
  return (id: string) => {
    if (id === 'auto-policy') return 'Automatic release policy'
    if (id === 'leak-detector') return 'Leak detector'
    if (id === 'controller') return 'Valve controller'
    if (id === 'safety-interlock') return 'Safety interlock'
    return users.find((u) => u.id === id)?.name ?? id
  }
}

export function useVisibleTanks(): Tank[] {
  const me = useMe()
  const tanks = useStore((s) => s.tanks)
  return useMemo(() => tanks.filter((t) => canViewTank(me, t as Tank)) as Tank[], [tanks, me])
}

export function useTankView(tank: Tank | undefined) {
  const devices = useStore((s) => s.devices)
  const valves = useStore((s) => s.valves)
  const now = Date.now()
  if (!tank) return null
  const device = devices.find((d) => d.id === tank.levelDeviceId)
  const valve = valves.find((v) => v.id === tank.valveId)
  const health = deviceHealth(device, now, valve?.config.staleAfterSec)
  return {
    pct: percentFull(tank.volumeL, tank.capacityL),
    status: tankStatus(tank, device, now, valve?.config.staleAfterSec),
    device,
    valve,
    health,
    live: device?.source === 'live',
    unavailable: health === 'offline' || health === 'disabled' || health === 'awaiting',
  }
}

export function useDrainView(drain: Drain | undefined) {
  const devices = useStore((s) => s.devices)
  if (!drain) return null
  const device = devices.find((d) => d.id === drain.deviceId)
  const now = Date.now()
  const health = deviceHealth(device, now)
  return { status: drainStatus(drain, device, now), device, health, live: device?.source === 'live', unavailable: health === 'offline' || health === 'disabled' || health === 'awaiting' }
}

export function isForUser(n: AppNotification, u: User) {
  return (n.userIds?.includes(u.id) ?? false) || (n.roles?.includes(u.role) ?? false)
}

export function useMyNotifications() {
  const me = useMe()
  const all = useStore((s) => s.notifications)
  return useMemo(() => {
    const prefOk = (n: AppNotification) => me.notificationPrefs[n.kind] !== false || n.severity === 'critical'
    const list = all.filter((n) => isForUser(n, me) && prefOk(n))
    return { list, unread: list.filter((n) => !n.readBy.includes(me.id)).length }
  }, [all, me])
}
