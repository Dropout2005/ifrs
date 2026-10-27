import { useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import type { Status } from '../domain/types'

export type MapAssetType = 'tank' | 'drain' | 'report' | 'event' | 'task' | 'site'

export interface MapPoint {
  id: string
  type: MapAssetType
  lat: number
  lng: number
  title: string
  status: Status
  detail: string
  link?: string
  approx?: boolean
}

const TYPE_GLYPH: Record<MapAssetType, string> = { tank: 'T', drain: 'D', report: 'R', event: 'C', task: 'M', site: '★' }
const TYPE_LABEL: Record<MapAssetType, string> = { tank: 'Tank', drain: 'Drain', report: 'Citizen report', event: 'Cleanup event', task: 'Maintenance', site: 'Prototype site' }
const STATUS_COLOR: Record<Status, string> = { normal: '#2f8a4c', monitor: '#138a80', warning: '#e39a1b', critical: '#d62839', offline: '#7b8794', inspect: '#1d4275' }
const STATUS_GLYPH: Record<Status, string> = { normal: '✓', monitor: '●', warning: '!', critical: '‼', offline: '×', inspect: '?' }

const iconCache = new Map<string, L.DivIcon>()
function icon(type: MapAssetType, status: Status) {
  const k = `${type}-${status}`
  if (!iconCache.has(k)) {
    const c = STATUS_COLOR[status]
    const shape = type === 'drain' ? 'border-radius:8px' : type === 'report' ? 'border-radius:50% 50% 50% 4px' : 'border-radius:50%'
    iconCache.set(
      k,
      L.divIcon({
        className: 'ifrs-marker',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -16],
        html: `<div style="position:relative;width:34px;height:34px;${shape};background:${type === 'site' ? '#0b2545' : '#fff'};border:3px solid ${c};display:grid;place-items:center;font:800 13px Inter,sans-serif;color:${type === 'site' ? '#2ec4b6' : '#0b2545'};box-shadow:0 2px 8px rgba(0,0,0,.25)">${TYPE_GLYPH[type]}<span style="position:absolute;right:-7px;top:-7px;min-width:17px;height:17px;border-radius:9px;background:${c};color:#fff;font:800 10px/17px Inter,sans-serif;text-align:center;border:2px solid #fff">${STATUS_GLYPH[status]}</span></div>`,
      }),
    )
  }
  return iconCache.get(k)!
}

function ClickCatcher({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

export function AssetMap({
  points,
  height = 380,
  center = [10.6585, -61.5155],
  zoom = 14,
  onPick,
  picked,
}: {
  points: MapPoint[]
  height?: number
  center?: [number, number]
  zoom?: number
  onPick?: (lat: number, lng: number) => void
  picked?: [number, number] | null
}) {
  const [tileErrors, setTileErrors] = useState(0)
  const pickIcon = useMemo(() => icon('report', 'monitor'), [])
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-navy-100" style={{ height }}>
        <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }} attributionControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ tileerror: () => setTileErrors((n) => n + 1) }}
          />
          <ClickCatcher onPick={onPick} />
          {points.map((p) => (
            <Marker key={`${p.type}-${p.id}`} position={[p.lat, p.lng]} icon={icon(p.type, p.status)} title={`${TYPE_LABEL[p.type]}: ${p.title} (${p.status})`}>
              <Popup>
                <div className="min-w-44">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700">{TYPE_LABEL[p.type]}</div>
                  <div className="font-bold text-navy-900">{p.title}</div>
                  <div className="text-xs text-muted">{p.detail}</div>
                  <div className="mt-1 text-xs font-semibold" style={{ color: STATUS_COLOR[p.status] }}>
                    {STATUS_GLYPH[p.status]} {p.status === 'inspect' ? 'Needs inspection' : p.status[0].toUpperCase() + p.status.slice(1)}
                  </div>
                  {p.approx && <div className="mt-1 text-[11px] text-muted">Approximate public location</div>}
                  {p.link && (
                    <Link to={p.link} className="mt-1 inline-block text-xs font-semibold text-teal-700 underline">
                      Open details →
                    </Link>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          {picked && <Marker position={picked} icon={pickIcon} title="Selected location" />}
        </MapContainer>
        {tileErrors > 6 && (
          <div className="absolute left-14 right-3 top-3 z-[400] rounded-xl bg-white/95 px-3 py-2 text-xs text-ink shadow">
            Map tiles could not load (offline or blocked). Markers are still positioned; see the list below for details.
          </div>
        )}
        <div className="absolute bottom-2 left-2 z-[400] rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold text-amber-700 shadow">DEMO MARKERS</div>
      </div>
      <MapLegend />
    </div>
  )
}

export function MapLegend() {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted" aria-label="Map legend">
      {(Object.keys(TYPE_GLYPH) as MapAssetType[]).map((t) => (
        <span key={t}>
          <b className="text-navy-900">{TYPE_GLYPH[t]}</b> {TYPE_LABEL[t]}
        </span>
      ))}
      <span className="w-full sm:w-auto" />
      {(Object.keys(STATUS_GLYPH) as Status[]).map((s) => (
        <span key={s}>
          <b style={{ color: STATUS_COLOR[s] }}>{STATUS_GLYPH[s]}</b> {s === 'inspect' ? 'Needs inspection' : s}
        </span>
      ))}
    </div>
  )
}
