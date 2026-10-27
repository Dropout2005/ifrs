import { Link } from 'react-router-dom'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { useStore } from '../store/store'
import { useMe, useMyNotifications, useNow } from '../store/hooks'
import { timeAgo } from '../domain/calc'
import { Empty, PageHeader, Tag } from '../components/ui'

export default function Notifications() {
  const me = useMe()
  useNow(10000)
  const { list, unread } = useMyNotifications()
  const markRead = useStore((s) => s.markRead)
  const markAll = useStore((s) => s.markAllRead)
  return (
    <div>
      <PageHeader
        eyebrow={`${unread} unread`}
        title="Notifications"
        actions={
          <>
            <Link to="/settings" className="btn-ghost btn-sm">Preferences</Link>
            <button className="btn-ghost btn-sm" onClick={markAll} disabled={!unread}>
              <CheckCheck className="size-4" /> Mark all read
            </button>
          </>
        }
      >
        In-app alerts. Email and SMS are shown as <em>simulated</em> because no messaging provider is configured in this demo.
      </PageHeader>
      {list.length === 0 ? (
        <Empty icon={<BellOff className="size-6" />} title="You’re all caught up" />
      ) : (
        <ul className="space-y-2">
          {list.map((n) => {
            const read = n.readBy.includes(me.id)
            return (
              <li key={n.id}>
                <Link to={n.link ?? '#'} onClick={() => markRead(n.id)} className={`card flex gap-3 p-4 transition hover:shadow-lg ${read ? 'opacity-70' : ''}`}>
                  <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${n.severity === 'critical' ? 'bg-danger-100 text-danger-700' : n.severity === 'warning' ? 'bg-amber-100 text-amber-700' : n.severity === 'success' ? 'bg-leaf-100 text-leaf-600' : 'bg-teal-50 text-teal-700'}`}>
                    <Bell className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-navy-900">{n.title}</span>
                      {!read && <span className="size-2 rounded-full bg-danger-500" aria-label="Unread" />}
                    </div>
                    <div className="text-sm text-muted">{n.body}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span className="capitalize">{n.severity}</span> · {n.kind} · {timeAgo(n.t)}
                      {n.simulatedChannels.map((c) => (
                        <Tag key={c} tone="gray">{c}</Tag>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
