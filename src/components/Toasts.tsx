import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useStore } from '../store/store'

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[2000] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite">
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CircleCheck : t.kind === 'error' ? TriangleAlert : Info
        const cls = t.kind === 'success' ? 'bg-navy-900 text-white' : t.kind === 'error' ? 'bg-danger-700 text-white' : 'bg-white text-navy-900 border border-navy-100'
        return (
          <div key={t.id} className={`pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl ${cls}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-m-1 p-1 opacity-70 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** Helper: run a store action returning {ok,message} and show a toast. */
export function useAct() {
  const toast = useStore((s) => s.toast)
  return (r: { ok: boolean; message: string }) => {
    toast(r.ok ? 'success' : 'error', r.message)
    return r.ok
  }
}
