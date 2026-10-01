import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useActivity, useStudy } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import Rich from '../components/Rich'
import TopBar from '../components/TopBar'
import { shuffle } from '../lib/text'
import type { Card, SetRow } from '../types'

const SECONDS = 60

export default function Blast() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { data, error, loading } = useStudy(id!, sp.get('starred') === '1')
  if (loading && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><Loading /></div>
  if (error && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><ErrorBox msg={error} /></div>
  if (!data) return null
  if (data.cards.length < 4) return <div className="page study"><TopBar close={`/set/${id}`} /><div className="empty">המשחק דורש 4 כרטיסיות לפחות.</div></div>
  return <Game set={data.set} cards={data.cards} />
}

type Round = { card: Card; options: Card[] }

function Game({ set, cards }: { set: SetRow; cards: Card[] }) {
  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [left, setLeft] = useState(SECONDS)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(1)
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const [round, setRound] = useState<Round | null>(null)
  const [popped, setPopped] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const [best, setBest] = useState(() => Number(localStorage.getItem('fc:blast:' + set.id)) || 0)
  const activity = useActivity()
  const last = useRef<string | null>(null)
  const locked = useRef(false)

  const order = useMemo(() => cards, [cards])

  function newRound() {
    let card = order[Math.floor(Math.random() * order.length)]
    if (order.length > 1 && card.id === last.current) card = order.find((c) => c.id !== last.current)!
    last.current = card.id
    const seen = new Set([card.term])
    const others: Card[] = []
    for (const c of shuffle(order)) {
      if (!seen.has(c.term)) { seen.add(c.term); others.push(c) }
      if (others.length === 3) break
    }
    setRound({ card, options: shuffle([card, ...others]) })
    locked.current = false
  }

  function start() {
    setScore(0); setCombo(1); setHits(0); setMisses(0); setLeft(SECONDS); setPopped(null); setWrong(null)
    newRound()
    setPhase('play')
  }

  useEffect(() => {
    if (phase !== 'play') return
    const t = setInterval(() => setLeft((l) => Math.max(0, +(l - 0.1).toFixed(2))), 100)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'play' && left <= 0) {
      setPhase('over')
      activity.flush()
      setBest((b) => {
        const nb = Math.max(b, score)
        try { localStorage.setItem('fc:blast:' + set.id, String(nb)) } catch { /* ignore */ }
        return nb
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase])

  function pick(c: Card) {
    if (phase !== 'play' || !round || locked.current) return
    locked.current = true
    if (c.id === round.card.id) {
      setPopped(c.id)
      setScore((s) => s + 100 * combo)
      setCombo((k) => Math.min(5, k + 1))
      setHits((h) => h + 1)
      activity.add(true)
      setTimeout(() => { setPopped(null); newRound() }, 260)
    } else {
      setWrong(c.id)
      setCombo(1)
      setMisses((m) => m + 1)
      setLeft((l) => Math.max(0, l - 3))
      activity.add(false)
      setTimeout(() => { setWrong(null); locked.current = false }, 380)
    }
  }

  return (
    <div className="page study">
      <TopBar close={`/set/${set.id}`} title="פיצוץ" right={<span className="pill" dir="ltr">{score}</span>} />

      {phase === 'ready' && (
        <div className="index-card center mt" style={{ padding: '28px 20px' }}>
          <h2>פוצץ את התשובה הנכונה</h2>
          <p className="muted mt-s">יש לך {SECONDS} שניות. כל תשובה נכונה מעלה את המכפיל עד x5, וטעות מורידה 3 שניות.</p>
          {best > 0 && <p className="mt-s">שיא: <b>{best}</b></p>}
          <button className="btn primary mt" onClick={start}>התחל</button>
        </div>
      )}

      {phase === 'play' && round && (
        <>
          <div className="progress"><i style={{ width: `${(left / SECONDS) * 100}%`, background: left < 10 ? 'var(--bad)' : undefined }} /></div>
          <div className="row spread mt-s small muted">
            <span dir="ltr">{left.toFixed(0)}s</span>
            <span className="pill warn">x{combo}</span>
          </div>
          <div className="index-card center mt" style={{ padding: '22px 18px' }}>
            <div className="q-prompt" dir="auto"><Rich text={round.card.definition} /></div>
          </div>
          <div className="bubbles">
            {round.options.map((o) => (
              <button key={o.id} className={'bubble-btn' + (popped === o.id ? ' popped' : '') + (wrong === o.id ? ' wrong' : '')} dir="auto" onClick={() => pick(o)}>
                <Rich text={o.term} />
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'over' && (
        <div className="index-card center mt" style={{ padding: '28px 20px' }}>
          <h1>{score}</h1>
          <p className="muted">{hits} נכונות · {misses} טעויות{score >= best && score > 0 ? ' · שיא חדש' : ''}</p>
          <div className="row mt" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={start}>שוב</button>
            <Link className="btn" to={`/set/${set.id}`}>לסט</Link>
          </div>
        </div>
      )}
    </div>
  )
}
