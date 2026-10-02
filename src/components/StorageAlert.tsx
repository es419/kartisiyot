import { useEffect, useRef, useState } from 'react'
import { getUsage } from '../api'
import { fmtMB, usageRows, type UsageRow } from '../lib/usage'

/** חלון אדום שמופיע בכל כניסה לאפליקציה כשבסיס הנתונים או אחסון הקבצים מתמלאים */
export default function StorageAlert() {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [open, setOpen] = useState(false)
  const hiddenAt = useRef<number | null>(null)

  async function check() {
    try {
      const bad = usageRows(await getUsage()).filter((r) => r.level !== 'ok')
      setRows(bad)
      setOpen(bad.length > 0)
    } catch {
      /* הפונקציה עוד לא הוגדרה, או שאין רשת. לא מציגים כלום */
    }
  }

  useEffect(() => {
    check()
    // חזרה לאפליקציה אחרי כמה דקות ברקע נחשבת כניסה חדשה
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 5 * 60 * 1000) { hiddenAt.current = null; check() }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (!open || rows.length === 0) return null
  const full = rows.some((r) => r.level === 'full')

  return (
    <div className="alert-bg" role="alertdialog" aria-modal="true" aria-label="המקום מתמלא">
      <div className="alert-card">
        <div className="alert-head">{full ? 'המקום ב-Supabase נגמר' : 'המקום ב-Supabase מתמלא'}</div>
        <div className="col">
          {rows.map((r) => (
            <div key={r.kind}>
              <div className="row spread small">
                <b>{r.label}</b>
                <span dir="ltr">{fmtMB(r.used)} / {fmtMB(r.limit)} ({Math.min(100, Math.round(r.pct * 100))}%)</span>
              </div>
              <div className="progress red mt-s"><i style={{ width: `${Math.min(100, r.pct * 100)}%` }} /></div>
            </div>
          ))}
          <p className="small">
            {full
              ? 'כשהמכסה מלאה Supabase עשוי לחסום כתיבה, והשמירה באפליקציה תיכשל.'
              : 'כשהמכסה תתמלא, Supabase עשוי לחסום כתיבה והשמירה באפליקציה תיכשל.'}{' '}
            אפשר למחוק סטים, תרשימים ותמונות שלא נחוצים, או לשדרג את התוכנית.
          </p>
          <button className="btn danger block" onClick={() => setOpen(false)}>הבנתי</button>
        </div>
      </div>
    </div>
  )
}
