import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { aiGrade, aiTest } from '../ai'
import { bumpActivity } from '../api'
import { useStudy } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import AiNote, { aiErrorText, aiFallbackText } from '../components/AiNote'
import Rich from '../components/Rich'
import TopBar from '../components/TopBar'
import { gradeWith } from '../lib/grading'
import type { AiQuestion } from '../types'

export default function AiTestPage() {
  const { id } = useParams()
  const { data, error, loading } = useStudy(id!, false)
  const [source, setSource] = useState<'set' | 'text'>('set')
  const [text, setText] = useState('')
  const [count, setCount] = useState(10)
  const [phase, setPhase] = useState<'config' | 'loading' | 'taking' | 'result'>('config')
  const [qs, setQs] = useState<AiQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [outcome, setOutcome] = useState<Record<number, boolean>>({})
  const [err, setErr] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [aiNote, setAiNote] = useState<string | null>(null)

  if (loading && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><Loading /></div>
  if (error && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><ErrorBox msg={error} /></div>
  if (!data) return null
  const setId = data.set.id

  async function generate() {
    setErr(null)
    if (source === 'text' && text.trim().length < 40) return setErr('הדבק חומר ארוך יותר.')
    setPhase('loading')
    try {
      const out = await aiTest({
        count,
        cards: source === 'set' ? data!.cards.map((c) => ({ term: c.term, definition: c.definition })) : undefined,
        text: source === 'text' ? text : undefined
      })
      if (!out.length) throw new Error('לא נוצרו שאלות. נסה חומר אחר.')
      setQs(out); setAnswers({}); setOutcome({}); setPhase('taking')
      window.scrollTo(0, 0)
    } catch (e) {
      setErr(aiErrorText((e as Error).message))
      setPhase('config')
    }
  }

  async function submit() {
    setAiNote(null)
    const out: Record<number, boolean> = {}
    const shorts: number[] = []
    qs.forEach((q, i) => {
      const a = answers[i] ?? ''
      if (q.type === 'short') {
        const ok = gradeWith(data!.set.grading ?? 'flexible', a, q.answer) !== 'no'
        out[i] = ok
        if (!ok && a.trim().length > 1) shorts.push(i)
      } else out[i] = a === q.answer
    })
    if (shorts.length && data!.set.grading === 'smart') {
      setChecking(true)
      try {
        const v = await aiGrade(shorts.map((i) => ({ q: qs[i].q, expected: qs[i].answer, given: answers[i] })))
        shorts.forEach((i, k) => { if (v[k] !== 'no') out[i] = true })
      } catch (e) { setAiNote(aiFallbackText((e as Error).message)) }
      setChecking(false)
    }
    setOutcome(out)
    setPhase('result')
    bumpActivity(qs.length, Object.values(out).filter(Boolean).length).catch(() => {})
    window.scrollTo(0, 0)
  }

  const correct = Object.values(outcome).filter(Boolean).length
  const done = phase === 'result'

  if (phase === 'config' || phase === 'loading') {
    return (
      <div className="page study">
        <TopBar close={`/set/${setId}`} title="מבחן AI" />
        <p className="muted">ה-AI כותב שאלות חדשות שבודקות הבנה, ולא רק את הכרטיסיות עצמן.</p>
        <div className="tabs mt">
          <button className={'chip' + (source === 'set' ? ' on' : '')} onClick={() => setSource('set')}>מהכרטיסיות של הסט</button>
          <button className={'chip' + (source === 'text' ? ' on' : '')} onClick={() => setSource('text')}>מחומר שאדביק</button>
        </div>
        {source === 'text' && <textarea className="textarea mt-s" rows={8} dir="auto" placeholder="הדבק כאן סיכום או חומר ללימוד" value={text} onChange={(e) => setText(e.target.value)} />}
        <label className="field mt">מספר שאלות
          <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        {err && <div className="error mt">{err}</div>}
        <button className="btn primary block mt" disabled={phase === 'loading'} onClick={generate}>{phase === 'loading' ? 'כותב שאלות…' : 'צור מבחן'}</button>
        <AiNote text="החומר נשלח ל-Anthropic דרך הפונקציה שלך. אל תשתמש בחומר פנימי או רגיש מהעבודה." />
      </div>
    )
  }

  return (
    <div className="page study">
      <TopBar close={`/set/${setId}`} title={done ? `תוצאות: ${correct}/${qs.length}` : 'מבחן AI'} />
      {done && (
        <div className="index-card center mt" style={{ padding: '22px 18px' }}>
          <h1>{Math.round((correct / Math.max(1, qs.length)) * 100)}%</h1>
          <p className="muted">{correct} מתוך {qs.length} נכונות</p>
          <div className="row mt-s" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => setPhase('config')}>מבחן חדש</button>
            <Link className="btn" to={`/set/${setId}`}>לסט</Link>
          </div>
        </div>
      )}
      {done && aiNote && <div className="error mt">{aiNote}</div>}
      <div className="col mt">
        {qs.map((q, i) => {
          const ok = outcome[i]
          return (
            <div key={i} className="entry" style={done ? { borderColor: ok ? 'var(--good)' : 'var(--bad)' } : undefined}>
              <span className="badge">{i + 1}</span>
              <p className="q-prompt mt-s" dir="auto"><Rich text={q.q} /></p>
              {q.type === 'mc' && (
                <div className="opts">
                  {(q.options ?? []).map((o, k) => {
                    const chosen = answers[i] === o
                    let cls = ''
                    if (done) cls = o === q.answer ? ' good' : chosen ? ' bad' : ''
                    else if (chosen) cls = ' good'
                    return <button key={k} className={'opt' + cls} disabled={done} dir="auto" onClick={() => setAnswers({ ...answers, [i]: o })}><Rich text={o} /></button>
                  })}
                </div>
              )}
              {q.type === 'tf' && (
                <div className="row mt-s">
                  {(['true', 'false'] as const).map((v) => {
                    const chosen = answers[i] === v
                    let cls = ''
                    if (done) cls = v === q.answer ? ' good' : chosen ? ' bad' : ''
                    else if (chosen) cls = ' good'
                    return <button key={v} className={'opt grow' + cls} disabled={done} onClick={() => setAnswers({ ...answers, [i]: v })}>{v === 'true' ? 'נכון' : 'לא נכון'}</button>
                  })}
                </div>
              )}
              {q.type === 'short' && <input className="input mt-s" dir="auto" autoCapitalize="off" spellCheck={false} placeholder="התשובה שלך" value={answers[i] ?? ''} readOnly={done} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} />}
              {done && (
                <div className={'feedback ' + (ok ? 'good' : 'bad')}>
                  {!ok && <div>התשובה הנכונה: <span className="answer-line" dir="auto"><Rich text={q.type === 'tf' ? (q.answer === 'true' ? 'נכון' : 'לא נכון') : q.answer} /></span></div>}
                  {q.explanation && <div className="small mt-s" dir="auto"><Rich text={q.explanation} /></div>}
                  {ok && !q.explanation && 'נכון'}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {!done && <button className="btn primary block mt" disabled={checking} onClick={submit}>{checking ? 'בודק…' : 'סיים ובדוק'}</button>}
      <AiNote />
    </div>
  )
}
