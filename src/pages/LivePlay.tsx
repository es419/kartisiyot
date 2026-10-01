import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { Logo } from '../components/Logo'
import Rich from '../components/Rich'
import { liveChannel, type LiveQ, type Score } from '../lib/live'

type Phase = 'join' | 'wait' | 'question' | 'answered' | 'result' | 'end'

/** מסך השחקן: נכנסים עם קוד ושם, בלי התחברות */
export default function LivePlay() {
  const { code: codeParam } = useParams()
  const [code, setCode] = useState(codeParam ?? '')
  const [name, setName] = useState(() => localStorage.getItem('fc:nick') ?? '')
  const [phase, setPhase] = useState<Phase>('join')
  const [q, setQ] = useState<LiveQ | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [correct, setCorrect] = useState(-1)
  const [board, setBoard] = useState<Score[]>([])
  const [left, setLeft] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ch = useRef<RealtimeChannel | null>(null)
  const pid = useRef(crypto.randomUUID())
  const deadline = useRef(0)

  useEffect(() => () => { if (ch.current) supabase.removeChannel(ch.current) }, [])

  useEffect(() => {
    if (phase !== 'question') return
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 250)
    return () => clearInterval(t)
  }, [phase])

  function join() {
    if (!/^\d{4}$/.test(code.trim())) return setErr('הקוד הוא 4 ספרות.')
    if (!name.trim()) return setErr('בחר כינוי.')
    setErr(null)
    setBusy(true)
    try { localStorage.setItem('fc:nick', name.trim()) } catch { /* ignore */ }
    const c = liveChannel(code.trim(), pid.current)
    ch.current = c
    c.on('broadcast', { event: 'q' }, ({ payload }: { payload: LiveQ }) => {
      setQ(payload); setChoice(null); setCorrect(-1)
      deadline.current = Date.now() + payload.ms
      setLeft(Math.ceil(payload.ms / 1000))
      setPhase('question')
    })
    c.on('broadcast', { event: 'result' }, ({ payload }: { payload: { correct: number; board: Score[] } }) => {
      setCorrect(payload.correct); setBoard(payload.board); setPhase('result')
    })
    c.on('broadcast', { event: 'end' }, ({ payload }: { payload: { board: Score[] } }) => {
      setBoard(payload.board); setPhase('end')
    })
    c.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await c.track({ name: name.trim() })
        setBusy(false)
        setPhase('wait')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setBusy(false)
        setErr('ההתחברות נכשלה. בדוק את הקוד ואת החיבור.')
      }
    })
  }

  function answer(i: number) {
    if (!q || choice !== null) return
    setChoice(i)
    setPhase('answered')
    ch.current?.send({ type: 'broadcast', event: 'ans', payload: { pid: pid.current, i: q.i, choice: i } })
  }

  const me = board.findIndex((b) => b.id === pid.current)
  const myScore = me >= 0 ? board[me].score : 0

  return (
    <div className="page study" style={{ maxWidth: 480 }}>
      <div className="row" style={{ justifyContent: 'center' }}><Logo size={36} /><h2>חידון חי</h2></div>

      {phase === 'join' && (
        <div className="index-card mt" style={{ padding: '22px 18px' }}>
          <form className="col" onSubmit={(e) => { e.preventDefault(); join() }}>
            <label className="field">קוד המשחק
              <input className="input" inputMode="numeric" maxLength={4} dir="ltr" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="0000" style={{ fontSize: 24, textAlign: 'center', letterSpacing: '.2em' }} />
            </label>
            <label className="field">כינוי
              <input className="input" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} placeholder="איך יקראו לך?" />
            </label>
            {err && <div className="error">{err}</div>}
            <button className="btn primary" disabled={busy}>{busy ? 'מתחבר…' : 'הצטרף'}</button>
          </form>
        </div>
      )}

      {phase === 'wait' && (
        <div className="index-card center mt" style={{ padding: '30px 18px' }}>
          <h2>אתה בפנים, {name}</h2>
          <p className="muted mt-s">ממתין שהמארח יתחיל את המשחק…</p>
        </div>
      )}

      {phase === 'question' && q && (
        <>
          <div className="progress mt"><i style={{ width: `${(left / (q.ms / 1000)) * 100}%` }} /></div>
          <div className="index-card center mt" style={{ padding: '18px 16px' }}>
            <span className="muted small">שאלה {q.i + 1} מתוך {q.total}</span>
            <div className="q-prompt" dir="auto"><Rich text={q.prompt} /></div>
          </div>
          <div className="col mt">
            {q.options.map((o, i) => (
              <button key={i} className={'live-opt c' + (i % 4)} dir="auto" onClick={() => answer(i)}><Rich text={o} /></button>
            ))}
          </div>
        </>
      )}

      {phase === 'answered' && (
        <div className="index-card center mt" style={{ padding: '30px 18px' }}>
          <h2>התשובה נשלחה</h2>
          <p className="muted mt-s">ממתין לשאר השחקנים…</p>
        </div>
      )}

      {phase === 'result' && q && (
        <div className="mt">
          <div className={'feedback ' + (choice === correct ? 'good' : 'bad')} style={{ textAlign: 'center' }}>
            <b>{choice === null ? 'לא ענית' : choice === correct ? 'נכון' : 'לא נכון'}</b>
            {choice !== correct && <div className="small mt-s" dir="auto">התשובה: <Rich text={q.options[correct] ?? ''} /></div>}
          </div>
          <div className="index-card center mt" style={{ padding: '18px' }}>
            <div className="muted small">מקום</div>
            <h1>{me >= 0 ? me + 1 : '-'}</h1>
            <div className="muted">{myScore} נקודות</div>
          </div>
        </div>
      )}

      {phase === 'end' && (
        <div className="mt">
          <h1 className="center">המשחק נגמר</h1>
          <p className="center muted mt-s">{me >= 0 ? `סיימת במקום ${me + 1} עם ${myScore} נקודות` : ''}</p>
          <div className="list mt">
            {board.slice(0, 10).map((b, i) => (
              <div key={b.id} className={'board-row' + (b.id === pid.current ? ' me' : '')}><span className="rank">{i + 1}</span><b className="grow">{b.name}</b><span dir="ltr">{b.score}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
