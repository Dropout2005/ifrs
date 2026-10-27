import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Toasts } from './components/Toasts'
import { useStore } from './store/store'
import { useMe } from './store/hooks'
import { setSimAccel } from './domain/calc'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'

const Tanks = lazy(() => import('./pages/Tanks'))
const TankDetail = lazy(() => import('./pages/TankDetail'))
const Drains = lazy(() => import('./pages/Drains'))
const DrainDetail = lazy(() => import('./pages/DrainDetail'))
const Leaks = lazy(() => import('./pages/Leaks'))
const MapPage = lazy(() => import('./pages/MapPage'))
const Community = lazy(() => import('./pages/Community'))
const Rewards = lazy(() => import('./pages/Rewards'))
const Rebates = lazy(() => import('./pages/Rebates'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Settings = lazy(() => import('./pages/Settings'))
const Prototype = lazy(() => import('./pages/Prototype'))
const Demo = lazy(() => import('./pages/Demo'))

/** Drives the simulation and (optionally) polls a live sensor feed. */
function Engines() {
  const running = useStore((s) => s.sim.running)
  const tickMs = useStore((s) => s.sim.tickMs)
  const tick = useStore((s) => s.tick)
  const dataSource = useStore((s) => s.sim.dataSource)
  const liveUrl = useStore((s) => s.sim.liveUrl)
  const pollSec = useStore((s) => s.sim.livePollSec)
  const ingest = useStore((s) => s.ingestLive)
  const setSim = useStore((s) => s.setSim)

  const minutesPerTick = useStore((s) => s.sim.minutesPerTick)
  setSimAccel((minutesPerTick * 60_000) / tickMs)

  useEffect(() => {
    if (!running) return
    tick()
    const t = setInterval(tick, tickMs)
    return () => clearInterval(t)
  }, [running, tickMs, tick])

  useEffect(() => {
    if (dataSource !== 'live' || !/^https:\/\//.test(liveUrl)) return
    let stop = false
    const poll = async () => {
      try {
        const res = await fetch(liveUrl, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!stop) ingest(Array.isArray(json) ? json : [json])
      } catch (e) {
        if (!stop) setSim({ liveLastStatus: `Fetch failed: ${(e as Error).message}` })
      }
    }
    poll()
    const t = setInterval(poll, Math.max(3, pollSec) * 1000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [dataSource, liveUrl, pollSec, ingest, setSim])
  return null
}

function A11y() {
  const me = useMe()
  useEffect(() => {
    const c = document.documentElement.classList
    c.toggle('large-text', me.accessibility.largeText)
    c.toggle('reduce-motion', me.accessibility.reduceMotion)
  }, [me.accessibility.largeText, me.accessibility.reduceMotion])
  return null
}

function Loading() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-sm text-muted" role="status">
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Engines />
      <A11y />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/*"
          element={
            <Layout>
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="tanks" element={<Tanks />} />
                  <Route path="tanks/:id" element={<TankDetail />} />
                  <Route path="drains" element={<Drains />} />
                  <Route path="drains/:id" element={<DrainDetail />} />
                  <Route path="leaks" element={<Leaks />} />
                  <Route path="map" element={<MapPage />} />
                  <Route path="community" element={<Community />} />
                  <Route path="rewards" element={<Rewards />} />
                  <Route path="rebates" element={<Rebates />} />
                  <Route path="maintenance" element={<Maintenance />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="settings/:tab" element={<Settings />} />
                  <Route path="prototype" element={<Prototype />} />
                  <Route path="demo" element={<Demo />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </Layout>
          }
        />
      </Routes>
      <Toasts />
    </HashRouter>
  )
}
