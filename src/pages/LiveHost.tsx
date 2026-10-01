import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { useStudy } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import Rich from '../components/Rich'
import TopBar from '../components/TopBar'
import { liveChannel, newCode, sleep, type LiveQ, type Score } from '../lib/live'
import { shuffle } from '../lib/text'
import type { Card, SetRow } from '../types'

export default function LiveHost() {
  const { id } = useParams()
  const { data, error, loading } = useStudy(id!, false)
  if (loading && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><Loading /></div>
  if (error && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><ErrorBox msg={error} /></div>
  if (!data) return null
  if (data.cards.length < 4) return <div className="page study"><TopBar close={`/set/${id}`} /><div className="empty">חידון חי דורש 4 כרטיסיות לפחות.</div></div>
  return <Host set={data.set} cards={data.cards} />
}

type Phase = 'lobby' | 'question' | 'result' | 'end'

function Host({ set, cards }: { set: SetRow; cards: Card[] }) {
  const [code] = useState(newCode)
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([])
  const [phase, setPhase] = useState<Phase>('lobby')
  const [q, setQ] = useState<LiveQ | null>(null)
  const [answered, setAnswered] = useState(0)
  const [left, setLeft] = useState(0)
  const [correct, setCorrect] = useState(-1)
  const [board, setBoard] = useState<Score[]>([])
  const [connected, setConnected] = useState(false)
  const [rounds, setRounds] = useState(8)

  const ch = useRef<RealtimeChannel | null>(null)
  const run = useRef(0)
  const scores = useRef<Record<string, number>>({})
  const names = useRef<Record<string, string>>({})
  const playerCount = useRef(0)
  const cur = useRef<{ i: number; correct: number; start: number; ms: number; answers: Set<string> } | null>(null)
  const skip = useRef<(() => void) | null>(null)

  useEffect(() => {
    const c = liveChannel(code, 'host')
    ch.current = c
    const sync = () => {
      const st = c.presenceState() as Record<string, { name?: string; host?: boolean }[]>
      const list: { id: string; name: string }[] = []
      for (const [key, metas] of Object.entries(st)) {
        const m = metas[0]
        if (!m || m.host || !m.name) continue
        list.push({ id: key, name: m.name })
        names.current[key] = m.name
      }
      playerCount.current = list.length
      setPlayers(list)
    }
    c.on('presence', { event: 'sync' }, sync)
    c.on('broadcast', { event: 'ans' }, ({ payload }: { payload: { pid: string; i: number; choice: number } }) => {
      const g = cur.current
      if (!g || payload.i !== g.i || g.answers.has(payload.pid)) return
      g.answers.add(payload.pid)
      if (payload.choice === g.correct) {
        const t = Date.now() - g.start
        scores.current[payload.pid] = (scores.current[payload.pid] ?? 0) + Math.round(500 + 500 * Math.max(0, 1 - t / g.ms))
      }
      setAnswered(g.answers.size)
    })
    c.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true)
        await c.track({ host: true })
      }
    })
    return () => {
      run.current++
      supabase.removeChannel(c)
    }
  }, [code])

  const send = (event: string, payload: unknown) => ch.current?.send({ type: 'broadcast', event, payload })

  function makeBoard(): Score[] {
    return Object.keys(names.current)
      .map((id) => ({ id, name: names.current[id], score: scores.current[id] ?? 0 }))
      .sort((a, b) => b.score - a.score)
  }

  async function play() {
    const my = ++run.current
    scores.current = {}
    const pool = shuffle(cards).slice(0, Math.min(rounds, cards.length))
    for (let i = 0; i < pool.length; i++) {
      if (run.current !== my) return
      const card = pool[i]
      const seen = new Set([card.definition])
      const others: string[] = []
      for (const c of shuffle(cards)) {
        if (!seen.has(c.definition)) { seen.add(c.definition); others.push(c.definition) }
        if (others.length === 3) break
      }
      const options = shuffle([card.definition, ...others])
      const ms = 15000
      const question: LiveQ = { i, total: pool.length, prompt: card.term, options, ms }
      cur.current = { i, correct: options.indexOf(card.definition), start: Date.now(), ms, answers: new Set() }
      setQ(question); setAnswered(0); setCorrect(-1); setPhase('question')
      send('q', question)

      while (run.current === my && Date.now() - cur.current.start < ms && !(playerCount.current > 0 && cur.current.answers.size >= playerCount.current)) {
        setLeft(Math.max(0, Math.ceil((ms - (Date.now() - cur.current.start)) / 1000)))
        await sleep(200)
      }
      if (run.current !== my) return
      const b = makeBoard()
      const right = cur.current.correct
      cur.current = null
      setBoard(b); setCorrect(right); setPhase('result')
      send('result', { i, correct: right, board: b })

      if (i < pool.length - 1) {
        await new Promise<void>((resolve) => {
          skip.current = resolve
          setTimeout(resolve, 6000)
        })
        skip.current = null
      }
    }
    if (run.current !== my) return
    const final = makeBoard()
    setBoard(final); setPhase('end')
    send('end', { board: final })
  }

  const joinUrl = `${location.origin}${location.pathname}#/play/${code}`

  return (
    <div className="page study">
      <TopBar close={`/set/${set.id}`} title="חידון חי" right={phase !== 'lobby' ? <span className="pill" dir="ltr">{q ? `${q.i + 1} / ${q.total}` : ''}</span> : undefined} />

      {phase === 'lobby' && (
        <>
          <div className="index-card center" style={{ padding: '26px 18px' }}>
            <p className="muted">השחקנים נכנסים מהטלפון שלהם לכתובת:</p>
            <p dir="ltr" className="small" style={{ wordBreak: 'break-all' }}>{joinUrl.replace(/#\/play\/\d+$/, '#/play')}</p>
            <p className="muted mt-s">ומזינים את הקוד:</p>
            <div className="live-code">{code}</div>
            {!connected && <p className="muted small mt-s">מתחבר…</p>}
          </div>

          <h2 className="mt">שחקנים ({players.length})</h2>
          <div className="chips-wrap mt-s">
            {players.length === 0 && <span className="muted">עדיין אף אחד לא הצטרף.</span>}
            {players.map((p) => <span key={p.id} className="pill">{p.name}</span>)}
          </div>

          <label className="field mt">מספר שאלות
            <select className="select" value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
              {[5, 8, 10, 15].filter((n) => n <= cards.length || n === 5).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="btn primary block mt" disabled={players.length === 0 || !connected} onClick={play}>התחל משחק</button>
          <p className="muted small mt-s">המשחק מתנהל ב-Supabase Realtime. אם השחקנים לא מופיעים, בדוק ב-Supabase: Realtime, Settings, והפעל גישה ציבורית (Allow public access).</p>
        </>
      )}

      {phase === 'question' && q && (
        <>
          <div className="progress"><i style={{ width: `${(left / (q.ms / 1000)) * 100}%` }} /></div>
          <div className="row spread mt-s small muted"><span dir="ltr">{left}s</span><span>{answered} / {players.length} ענו</span></div>
          <div className="index-card center mt" style={{ padding: '24px 18px' }}>
            <div className="q-prompt" dir="auto"><Rich text={q.prompt} /></div>
          </div>
          <div className="live-grid mt">
            {q.options.map((o, i) => <div key={i} className={'live-opt c' + i} dir="auto"><Rich text={o} /></div>)}
          </div>
        </>
      )}

      {phase === 'result' && q && (
        <>
          <div className="live-grid">
            {q.options.map((o, i) => <div key={i} className={'live-opt c' + i + (i === correct ? '' : ' dim')} dir="auto"><Rich text={o} /></div>)}
          </div>
          <h2 className="mt">דירוג</h2>
          <div className="list mt-s">
            {board.slice(0, 5).map((b, i) => (
              <div key={b.id} className="board-row"><span className="rank">{i + 1}</span><b className="grow">{b.name}</b><span dir="ltr">{b.score}</span></div>
            ))}
          </div>
          <button className="btn primary block mt" onClick={() => skip.current?.()}>{q.i === q.total - 1 ? 'לתוצאות' : 'השאלה הבאה'}</button>
        </>
      )}

      {phase === 'end' && (
        <>
          <h1 className="center">המשחק נגמר</h1>
          <div className="list mt">
            {board.map((b, i) => (
              <div key={b.id} className="board-row"><span className="rank">{i + 1}</span><b className="grow">{b.name}</b><span dir="ltr">{b.score}</span></div>
            ))}
          </div>
          <div className="col mt">
            <Link className="btn primary" to={`/set/${set.id}`}>חזרה לסט</Link>
          </div>
        </>
      )}
    </div>
  )
}
