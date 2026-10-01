import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useActivity, useStudy } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import Rich from '../components/Rich'
import TopBar from '../components/TopBar'
import { fmtTime, shuffle } from '../lib/text'
import type { Card, SetRow } from '../types'

const GOAL = 10
const COLORS = ['#4255FF', '#0E9F6E', '#E8A400', '#E5484D', '#8B5CF6', '#14B8D4']

export default function Blocks() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { data, error, loading } = useStudy(id!, sp.get('starred') === '1')
  if (loading && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><Loading /></div>
  if (error && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><ErrorBox msg={error} /></div>
  if (!data) return null
  if (data.cards.length < 4) return <div className="page study"><TopBar close={`/set/${id}`} /><div className="empty">המשחק דורש 4 כרטיסיות לפחות.</div></div>
  return <Game set={data.set} cards={data.cards} />
}

type Round = { card: Card; options: string[] }

function Game({ set, cards }: { set: SetRow; cards: Card[] }) {
  const [height, setHeight] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [round, setRound] = useState<Round | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [crumble, setCrumble] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const start = useRef(Date.now())
  const last = useRef<string | null>(null)
  const activity = useActivity()
  const won = height >= GOAL

  function newRound() {
    let card = cards[Math.floor(Math.random() * cards.length)]
    if (card.id === last.current) card = cards.find((c) => c.id !== last.current)!
    last.current = card.id
    const seen = new Set([card.definition])
    const others: string[] = []
    for (const c of shuffle(cards)) {
      if (!seen.has(c.definition)) { seen.add(c.definition); others.push(c.definition) }
      if (others.length === 3) break
    }
    setRound({ card, options: shuffle([card.definition, ...others]) })
    setPicked(null)
  }

  useEffect(() => { newRound() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (won) { activity.flush(); return }
    const t = setInterval(() => setElapsed(Date.now() - start.current), 250)
    return () => clearInterval(t)
  }, [won]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(o: string) {
    if (!round || picked !== null || won) return
    setPicked(o)
    const ok = o === round.card.definition
    activity.add(ok)
    if (ok) {
      setTimeout(() => { setHeight((h) => h + 1); newRound() }, 450)
    } else {
      setMistakes((m) => m + 1)
      setTimeout(() => setCrumble(true), 500)
      setTimeout(() => { setCrumble(false); setHeight((h) => Math.max(0, h - 1)); newRound() }, 1250)
    }
  }

  function again() {
    setHeight(0); setMistakes(0); setElapsed(0); start.current = Date.now(); newRound()
  }

  return (
    <div className="page study">
      <TopBar close={`/set/${set.id}`} title="בלוקים" right={<span className="pill" dir="ltr">{height} / {GOAL}</span>} />

      {won ? (
        <div className="index-card center mt" style={{ padding: '28px 20px' }}>
          <h1>בנית את המגדל</h1>
          <p className="muted mt-s">{fmtTime(elapsed)} · {mistakes} טעויות</p>
          <div className="row mt" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={again}>שוב</button>
            <Link className="btn" to={`/set/${set.id}`}>לסט</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="progress"><i style={{ width: `${(height / GOAL) * 100}%` }} /></div>
          <div className="tower mt-s" aria-label={`גובה המגדל ${height}`}>
            {Array.from({ length: height }).map((_, i) => (
              <div key={i} className={'block' + (crumble && i === height - 1 ? ' crumble' : '')} style={{ background: COLORS[i % COLORS.length] }} />
            ))}
          </div>

          {round && (
            <div className="index-card q-card mt" style={{ paddingTop: 20 }}>
              <div className="q-prompt" dir="auto"><Rich text={round.card.term} /></div>
              <div className="opts">
                {round.options.map((o, i) => {
                  const isAns = o === round.card.definition
                  const cls = picked !== null ? (isAns ? ' good' : picked === o ? ' bad' : '') : ''
                  return <button key={i} className={'opt' + cls} disabled={picked !== null} dir="auto" onClick={() => pick(o)}><Rich text={o} /></button>
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
