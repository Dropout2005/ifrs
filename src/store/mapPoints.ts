import { useMemo } from 'react'
import { useStore } from './store'
import { useMe } from './hooks'
import { can, canViewTank } from '../domain/rbac'
import { drainStatus, fmtL, percentFull, tankStatus } from '../domain/calc'
import type { MapPoint } from '../components/AssetMap'
import type { Status, Tank } from '../domain/types'

const PUBLIC_REPORT: string[] = ['verified', 'assigned', 'in_progress', 'resolved']
const approx = (v: number) => Math.round(v * 1000) / 1000 // ≈100 m

export function useMapPoints(): MapPoint[] {
  const me = useMe()
  const s = useStore()
  return useMemo(() => {
    const now = Date.now()
    const staff = can(me, 'report:verify')
    const pts: MapPoint[] = []
    for (const t of s.tanks) {
      if (!canViewTank(me, t as Tank)) continue
      const b = s.buildings.find((x) => x.id === t.buildingId)
      if (!b) continue
      const dev = s.devices.find((d) => d.id === t.levelDeviceId)
      const st = tankStatus(t as Tank, dev, now)
      pts.push({ id: t.id, type: 'tank', lat: b.lat + (s.tanks.filter((x) => x.buildingId === b.id).indexOf(t) * 0.00012), lng: b.lng, title: t.name, status: st, detail: `${b.name} · ${st === 'offline' ? 'reading unavailable' : `${Math.round(percentFull(t.volumeL, t.capacityL))}% · ${fmtL(t.volumeL)}`}`, link: `/tanks/${t.id}` })
    }
    const site = s.buildings.find((b) => b.isPrototypeSite)
    if (site) pts.push({ id: site.id, type: 'site', lat: site.lat + 0.0004, lng: site.lng + 0.0004, title: 'Tatil Building – prototype station', status: 'normal', detail: 'IFRS demonstration rig', link: '/prototype' })
    for (const d of s.drains) {
      const dev = s.devices.find((x) => x.id === d.deviceId)
      const st = drainStatus(d, dev, now)
      pts.push({ id: d.id, type: 'drain', lat: d.lat, lng: d.lng, title: d.name, status: st, detail: st === 'offline' ? 'Sensor offline – level unavailable' : `${d.levelCm.toFixed(0)} cm of ${d.rangeCm} cm`, link: `/drains/${d.id}` })
    }
    for (const r of s.reports) {
      const mine = r.reporterId === me.id
      if (!staff && !mine && !PUBLIC_REPORT.includes(r.status)) continue
      if (['rejected', 'duplicate'].includes(r.status) && !staff) continue
      const st: Status = r.status === 'resolved' ? 'normal' : r.status === 'submitted' || r.status === 'under_review' ? 'inspect' : r.category === 'flooded-road' || r.category === 'overflowing-drain' ? 'warning' : 'monitor'
      const pub = !staff && !mine
      pts.push({ id: r.id, type: 'report', lat: pub ? approx(r.lat) : r.lat, lng: pub ? approx(r.lng) : r.lng, title: r.category.replace('-', ' ').replace(/^\w/, (c) => c.toUpperCase()), status: st, detail: `${r.status.replace(/_/g, ' ')} · ${r.locationText}`, link: '/community', approx: pub })
    }
    for (const e of s.events) {
      if (e.completed || e.end < now) continue
      pts.push({ id: e.id, type: 'event', lat: e.lat, lng: e.lng, title: e.title, status: 'monitor', detail: `${new Date(e.start).toLocaleString('en-TT', { dateStyle: 'medium', timeStyle: 'short' })} · ${e.registrations.length}/${e.capacity} registered`, link: '/community' })
    }
    if (can(me, 'maintenance:view')) {
      for (const t of s.tasks) {
        if (t.status === 'done' || t.status === 'cancelled') continue
        const drain = s.drains.find((d) => d.id === t.assetId)
        if (!drain) continue
        pts.push({ id: t.id, type: 'task', lat: drain.lat + 0.0003, lng: drain.lng + 0.0003, title: t.title, status: t.priority === 'high' ? 'warning' : 'monitor', detail: `${t.status.replace('_', ' ')} · ${t.priority} priority`, link: '/maintenance' })
      }
    }
    return pts
  }, [s.tanks, s.buildings, s.devices, s.drains, s.reports, s.events, s.tasks, me])
}
