import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { aiGuide, type Guide } from '../ai'
import { insertCards } from '../api'
import { useStudy } from '../hooks'
import { ErrorBox, Loading, useToast } from '../components/ui'
import AiNote, { aiErrorText } from '../components/AiNote'
import Md from '../components/Md'
import Rich from '../components/Rich'
import TopBar from '../components/TopBar'

export default function StudyGuide() {
  const { id } = useParams()
  const { data, error, loading } = useStudy(id!, false)
  const toast = useToast()
  const key = 'fc:guide:' + id
  const [guide, setGuide] = useState<Guide | null>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
  })
  const [source, setSource] = useState<'set' | 'text'>('set')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (guide) { try { localStorage.setItem(key, JSON.stringify(guide)) } catch { /* ignore */ } }
  }, [guide, key])

  if (loading && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><Loading /></div>
  if (error && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><ErrorBox msg={error} /></div>
  if (!data) return null
  const setId = data.set.id

  async function generate() {
    setErr(null)
    if (source === 'text' && text.trim().length < 40) return setErr('הדבק חומר ארוך יותר.')
    setBusy(true)
    try {
      const g = await aiGuide({
        cards: source === 'set' ? data!.cards.map((c) => ({ term: c.term, definition: c.definition })) : undefined,
        text: source === 'text' ? text : undefined
      })
      if (!g.sections.length) throw new Error('לא נוצר מדריך. נסה חומר אחר.')
      setGuide(g)
    } catch (e) {
      setErr(aiErrorText((e as Error).message))
    }
    setBusy(false)
  }

  async function toCards() {
    if (!guide) return
    try {
      await insertCards(setId, guide.questions.map((q) => ({ term: q.q, definition: q.a })))
      toast.show(`נוספו ${guide.questions.length} כרטיסיות`)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="page study">
      <TopBar close={`/set/${setId}`} title="מדריך לימוד AI" />

      {!guide ? (
        <>
          <p className="muted">סיכום מובנה עם כותרות ונקודות מפתח, ושאלות לבדיקה עצמית.</p>
          <div className="tabs mt">
            <button className={'chip' + (source === 'set' ? ' on' : '')} onClick={() => setSource('set')}>מהכרטיסיות של הסט</button>
            <button className={'chip' + (source === 'text' ? ' on' : '')} onClick={() => setSource('text')}>מחומר שאדביק</button>
          </div>
          {source === 'text' && <textarea className="textarea mt-s" rows={8} dir="auto" placeholder="הדבק כאן סיכום או חומר ללימוד" value={text} onChange={(e) => setText(e.target.value)} />}
          {err && <div className="error mt">{err}</div>}
          <button className="btn primary block mt" disabled={busy} onClick={generate}>{busy ? 'כותב מדריך…' : 'צור מדריך'}</button>
          <AiNote text="החומר נשלח ל-Anthropic דרך הפונקציה שלך. אל תשתמש בחומר פנימי או רגיש מהעבודה." />
        </>
      ) : (
        <>
          <h1>{guide.title}</h1>
          <div className="col mt">
            {guide.sections.map((s, i) => (
              <div key={i} className="entry">
                <h3 dir="auto"><Rich text={s.heading} /></h3>
                <Md text={s.points.map((p) => '- ' + p).join('\n')} />
              </div>
            ))}
          </div>

          {guide.questions.length > 0 && (
            <>
              <h2 className="mt">בדוק את עצמך</h2>
              <div className="col mt-s">
                {guide.questions.map((q, i) => (
                  <details key={i} className="qa">
                    <summary dir="auto"><Rich text={q.q} /></summary>
                    <div className="muted" dir="auto"><Rich text={q.a} /></div>
                  </details>
                ))}
              </div>
            </>
          )}

          {err && <div className="error mt">{err}</div>}
          <div className="col mt">
            <button className="btn primary" onClick={toCards}>הוסף את השאלות כרטיסיות לסט</button>
            <button className="btn" onClick={() => { setGuide(null); try { localStorage.removeItem(key) } catch { /* ignore */ } }}>מדריך חדש</button>
            <Link className="btn ghost" to={`/set/${setId}`}>חזרה לסט</Link>
          </div>
          <AiNote />
        </>
      )}
      {toast.node}
    </div>
  )
}
