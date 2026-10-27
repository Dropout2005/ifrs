import { Link } from 'react-router-dom'
import { ArrowRight, Cpu, Droplets, Filter, Gift, HandCoins, Siren, Users, Waves, MapPin, ShieldCheck, FlaskConical } from 'lucide-react'
import { Logo } from '../components/Logo'

function Rain() {
  const drops = Array.from({ length: 36 }, (_, i) => i)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {drops.map((i) => (
        <span
          key={i}
          className="absolute block w-px bg-gradient-to-b from-transparent to-teal-400/70"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 70}%`, height: `${18 + ((i * 7) % 22)}px`, animation: `rainfall ${1.1 + ((i * 13) % 10) / 10}s ${(i % 9) * 0.17}s linear infinite` }}
        />
      ))}
    </div>
  )
}

function WaveBand({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className={`block h-16 w-full sm:h-24 ${className}`} aria-hidden>
      <path d="M0 64c120 0 120-40 240-40s120 40 240 40 120-40 240-40 120 40 240 40 120-40 240-40 120 40 240 40v56H0z" fill="#2ec4b6" opacity=".35" />
      <path d="M0 84c120 0 120-32 240-32s120 32 240 32 120-32 240-32 120 32 240 32 120-32 240-32 120 32 240 32v36H0z" fill="#f6f8f7" />
    </svg>
  )
}

const PILLARS = [
  {
    Icon: Droplets,
    title: 'Rainwater collection & slow release',
    body: 'Roof-fed tanks store excess rainfall. Level sensors and a controlled valve release water slowly – only when the drains downstream can take it – and keep a reserve for toilet flushing and other non-potable uses.',
  },
  {
    Icon: Filter,
    title: 'Storm-drain waste collection',
    body: 'Mesh basket inserts under hinged manhole covers catch litter before it blocks the system. Drain-level sensors flag rising water and possible blockages so crews can respond early.',
  },
  {
    Icon: Users,
    title: 'Community empowerment',
    body: 'Residents report blocked drains and flooding, join cleanups, and earn reward points for verified contributions – building a culture of keeping Port of Spain’s drains clear.',
  },
]

const FEATURES = [
  { Icon: Droplets, t: 'Smart tank monitoring', d: 'Live level, capacity and history for every registered tank.' },
  { Icon: Waves, t: 'Drain monitoring', d: 'Water level, rate of rise and suspected blockages along the corridor.' },
  { Icon: ShieldCheck, t: 'Safe automated release', d: 'Transparent rules that hold water back when drains are high.' },
  { Icon: Siren, t: 'Leak detection', d: 'Spots unexplained water loss and walks you through the fix.' },
  { Icon: MapPin, t: 'Citizen reports', d: 'Report flooding or blocked drains and track the response.' },
  { Icon: Gift, t: 'Rewards', d: 'Points for verified cleanups and genuine reports.' },
  { Icon: HandCoins, t: 'Rebate programme (concept)', d: 'How a future water-rebate scheme could work.' },
  { Icon: Cpu, t: 'Prototype station', d: 'Our Arduino-based test rig at the Tatil Building.' },
]

export default function Landing() {
  return (
    <div className="min-h-dvh bg-sand-50">
      <div className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-[12px] font-bold text-navy-950">
        <FlaskConical className="size-3.5" aria-hidden /> Student prototype · demo data only
      </div>
      <header className="relative overflow-hidden bg-navy-900 text-white">
        <Rain />
        <div className="relative mx-auto max-w-6xl px-5 pb-6 pt-6 sm:px-8">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Logo className="size-10" />
              <div className="leading-tight">
                <div className="display text-xl">IFRS</div>
                <div className="text-[11px] text-white/60">The Department of Dry Affairs</div>
              </div>
            </div>
            <Link to="/dashboard" className="btn btn-sm bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20">
              Open dashboard
            </Link>
          </nav>

          <div className="grid items-center gap-10 pb-10 pt-12 sm:pt-16 lg:grid-cols-[1.15fr_.85fr]">
            <div>
              <div className="eyebrow text-teal-400">Group 4 · Port of Spain, Trinidad & Tobago</div>
              <h1 className="display mt-3 text-[3.1rem] sm:text-7xl">
                Channel the rain.
                <br />
                <span className="text-teal-400">Protect the terrain.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/80">
                The <strong className="text-white">Integrated Flood Resilience System</strong> links rainwater tanks, smart slow-release valves, drain sensors and community action into one platform – starting with a pilot on the South Quay / Wrightson Road corridor.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/dashboard" className="btn bg-teal-400 px-5 text-navy-950 hover:bg-teal-500">
                  Explore the live demo <ArrowRight className="size-4" />
                </Link>
                <Link to="/prototype" className="btn bg-white/10 px-5 text-white ring-1 ring-white/25 hover:bg-white/20">
                  <Cpu className="size-4" /> Tatil prototype station
                </Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-sm">
              <div className="rounded-[28px] bg-white/5 p-5 ring-1 ring-white/15 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">How it works</div>
                <ol className="mt-3 space-y-3">
                  {[
                    ['Rain falls', 'Roofs channel runoff into tanks instead of straight into the street.'],
                    ['Sensors watch', 'Tank and drain levels are measured continuously.'],
                    ['Release safely', 'Water is let out slowly – only when drains have room.'],
                    ['Community acts', 'Reports and cleanups keep drains clear.'],
                  ].map(([a, b], i) => (
                    <li key={a} className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-teal-400 text-[13px] font-extrabold text-navy-950">{i + 1}</span>
                      <div>
                        <div className="font-semibold">{a}</div>
                        <div className="text-[13px] text-white/70">{b}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
        <WaveBand />
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Why it matters">
          {[
            ['1960s', 'when much of Port of Spain’s drainage was built', 'UN-Habitat, 2012'],
            ['~30%', 'of drainage outfalls in central POS reported clogged', 'Jeppesen et al., 2015'],
            ['US$11.6M', 'estimated annual flood damage in the target area', 'IDB'],
            ['TT$636.8M', 'spent on flood mitigation via PSIP, 2018–2022', 'Ministry of Finance'],
          ].map(([n, t, src]) => (
            <div key={n} className="card p-4">
              <div className="display text-4xl text-navy-900">{n}</div>
              <div className="mt-1 text-sm text-ink">{t}</div>
              <div className="mt-1 text-[11px] text-muted">Source: {src}</div>
            </div>
          ))}
        </section>

        <section className="py-10">
          <div className="eyebrow">Three pillars</div>
          <h2 className="display mt-2 text-4xl text-navy-900 sm:text-5xl">One system, three defences</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PILLARS.map(({ Icon, title, body }, i) => (
              <article key={title} className="card relative overflow-hidden p-5">
                <div className="absolute -right-4 -top-6 display text-[7rem] text-navy-50 select-none" aria-hidden>
                  {i + 1}
                </div>
                <div className="relative">
                  <div className="grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                    <Icon className="size-6" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-navy-900">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] bg-navy-900 p-6 text-white sm:p-10">
          <div className="eyebrow text-teal-400">What you can do in the app</div>
          <h2 className="display mt-2 text-4xl sm:text-5xl">Main features</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ Icon, t, d }) => (
              <div key={t} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <Icon className="size-5 text-teal-400" aria-hidden />
                <div className="mt-2 font-semibold">{t}</div>
                <div className="mt-1 text-[13px] text-white/70">{d}</div>
              </div>
            ))}
          </div>
          <Link to="/dashboard" className="btn mt-7 bg-teal-400 text-navy-950 hover:bg-teal-500">
            Try it now <ArrowRight className="size-4" />
          </Link>
        </section>

        <section className="grid gap-4 py-10 md:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-lg font-bold text-navy-900">How residents take part</h2>
            <ul className="mt-3 space-y-2 text-[15px] text-ink">
              <li>• Register a rainwater tank and watch its level.</li>
              <li>• Report flooding, blocked drains or dumped litter with a location and photo.</li>
              <li>• Join a community cleanup and check in on the day.</li>
              <li>• Earn points once staff verify your contribution, and redeem them for rewards.</li>
            </ul>
          </div>
          <div className="card border-amber-500/40 bg-amber-100/40 p-5">
            <h2 className="text-lg font-bold text-navy-900">Honest limits</h2>
            <ul className="mt-3 space-y-2 text-[15px] text-ink">
              <li>• Software alone cannot prevent flooding. IFRS supports physical infrastructure and maintenance; it does not replace them.</li>
              <li>• All people, properties and readings in this demo are fictional or simulated.</li>
              <li>• Valve control shown here is simulated; real valves need a local controller with its own safety limits.</li>
              <li>• No official water-rebate scheme is implied – the rebate module shows how one could work.</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="bg-navy-950 py-8 text-center text-[13px] text-white/60">
        <Logo className="mx-auto mb-2 size-9" />
        IFRS · Group 4 – The Department of Dry Affairs
        <br />
        Samuel Blache · Asia Cooper · Keedanu Halls · Imani Zakuri
      </footer>
    </div>
  )
}
