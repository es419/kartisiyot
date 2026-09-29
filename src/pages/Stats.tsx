import { useState } from 'react'
import { boxCounts, computeStreak, getActivity } from '../api'
import { useLoad } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import PageHeader from '../components/PageHeader'
import { BOX_LABELS } from '../lib/srs'
import { getGoal, setGoal } from '../lib/goal'
import { todayStr } from '../lib/text'

export default function Stats() {
  const [goal, setGoalState] = useState(getGoal())
  const { data, error, loading } = useLoad(async () => {
    const [act, boxes] = await Promise.all([getActivity(120), boxCounts()])
    return { act, boxes }
  }, [])

  if (loading && !data) return <div className="page"><Loading /></div>
  if (error && !data) return <div className="page"><ErrorBox msg={error} /></div>
  if (!data) return null

  const byDay = new Map(data.act.map((a) => [a.day, a]))
  const days: { key: string; label: string; n: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const k = todayStr(d)
    days.push({ key: k, label: String(d.getDate()), n: byDay.get(k)?.cards ?? 0 })
  }
  const max = Math.max(1, ...days.map((d) => d.n))
  const today = byDay.get(todayStr())?.cards ?? 0
  const total = data.act.reduce((s, a) => s + a.cards, 0)
  const correct = data.act.reduce((s, a) => s + a.correct, 0)
  const streak = computeStreak(data.act)
  const tracked = data.boxes.reduce((a, b) => a + b, 0)

  // מפת חום: 17 שבועות, עמודה לשבוע (א׳-ש׳)
  const cells: { key: string; n: number; pad?: boolean }[] = []
  const start = new Date()
  start.setDate(start.getDate() - 17 * 7 + 1)
  start.setDate(start.getDate() - start.getDay())
  const end = new Date()
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = todayStr(d)
    cells.push({ key: k, n: byDay.get(k)?.cards ?? 0 })
  }
  const level = (n: number) => (n <= 0 ? 0 : n < goal * 0.25 ? 1 : n < goal * 0.5 ? 2 : n < goal ? 3 : 4)

  const pickGoal = (n: number) => { setGoal(n); setGoalState(n) }

  return (
    <div className="page">
      <PageHeader title="התקדמות" />
      <div className="stat-strip mt">
        <div className="stat"><b>{streak}</b><span>ימים ברצף</span></div>
        <div className="stat"><b>{today}</b><span>היום</span></div>
        <div className="stat"><b>{total ? Math.round((correct / total) * 100) : 0}%</b><span>דיוק (120 יום)</span></div>
      </div>

      <h2 className="mt">יעד יומי</h2>
      <div className="row wrap mt-s">
        {[10, 20, 30, 50, 100].map((n) => <button key={n} className={'chip' + (goal === n ? ' on' : '')} onClick={() => pickGoal(n)}>{n}</button>)}
        <input className="input" style={{ width: 90 }} type="number" min={1} value={goal} onChange={(e) => pickGoal(Number(e.target.value) || 1)} aria-label="יעד מותאם" />
        <span className="muted small">כרטיסיות ביום</span>
      </div>

      <h2 className="mt">4 החודשים האחרונים</h2>
      <div className="entry heat-wrap mt-s">
        <div className="heat" role="img" aria-label="מפת חום של פעילות">
          {cells.map((c) => (
            <i key={c.key} className={'l' + level(c.n)} title={`${c.key}: ${c.n}`} />
          ))}
        </div>
      </div>
      <p className="muted small mt-s">ככל שהכחול כהה יותר, התקרבת יותר ליעד היומי.</p>

      <h2 className="mt">14 הימים האחרונים</h2>
      <div className="bars entry mt-s" style={{ height: 160 }} role="img" aria-label="כרטיסיות שנלמדו ביום">
        {days.map((d, i) => (
          <div key={d.key} className={'bar' + (i === days.length - 1 ? ' today' : '')}>
            {d.n > 0 && <span>{d.n}</span>}
            <i style={{ height: `${(d.n / max) * 100}%` }} />
            <span>{d.label}</span>
          </div>
        ))}
      </div>

      <h2 className="mt">רמת שליטה ({tracked} כרטיסיות במעקב)</h2>
      <div className="boxes mt-s">
        {data.boxes.map((n, i) => (
          <div key={i}><b>{n}</b><span>{BOX_LABELS[i]}</span></div>
        ))}
      </div>
      <p className="muted small mt-s">הרמה נקבעת לפי כמה זמן הכרטיסייה צפויה להישאר בזיכרון. תשובה נכונה מרחיקה את החזרה הבאה, וטעות מחזירה אותה להתחלה.</p>
    </div>
  )
}
