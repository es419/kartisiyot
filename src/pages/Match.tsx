import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useActivity, useStudy } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import { fmtTime, shuffle } from '../lib/text'
import Rich from '../components/Rich'
import type { Card, SetRow } from '../types'

type Tile = { key: string; cardId: string; text: string; kind: 't' | 'd' }

export default function Match() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { data, error, loading } = useStudy(id!, sp.get('starred') === '1')
  if (loading && !data) return <div className="page"><Loading /></div>
  if (error && !data) return <div className="page"><ErrorBox msg={error} /></div>
  if (!data) return null
  return <Game set={data.set} cards={data.cards} />
}

function makeTiles(cards: Card[]): Tile[] {
  const pick = shuffle(cards).slice(0, 6)
  return shuffle(pick.flatMap((c) => [
    { key: c.id + 't', cardId: c.id, text: c.term, kind: 't' as const },
    { key: c.id + 'd', cardId: c.id, text: c.definition, kind: 'd' as const }
  ]))
}

function Game({ set, cards }: { set: SetRow; cards: Card[] }) {
  const [tiles, setTiles] = useState<Tile[]>(() => makeTiles(cards))
  const [gone, setGone] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<Tile | null>(null)
  const [wrong, setWrong] = useState<string[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [best, setBest] = useState<number | null>(() => {
    const v = localStorage.getItem('fc:best:' + set.id)
    return v ? Number(v) : null
  })
  const start = useRef(Date.now())
  const activity = useActivity()
  const pairs = tiles.length / 2
  const finished = gone.size === pairs

  useEffect(() => {
    if (finished) return
    const t = setInterval(() => setElapsed(Date.now() - start.current), 100)
    return () => clearInterval(t)
  }, [finished, tiles])

  useEffect(() => {
    if (!finished) return
    const total = Date.now() - start.current + mistakes * 1000
    setElapsed(total)
    if (best === null || total < best) {
      setBest(total)
      try { localStorage.setItem('fc:best:' + set.id, String(total)) } catch { /* ignore */ }
    }
    activity.flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  function tap(t: Tile) {
    if (gone.has(t.cardId) || wrong.length) return
    if (!sel) return setSel(t)
    if (sel.key === t.key) return setSel(null)
    if (sel.kind === t.kind) return setSel(t)
    if (sel.cardId === t.cardId) {
      setGone(new Set(gone).add(t.cardId))
      setSel(null)
      activity.add(true)
    } else {
      setMistakes((m) => m + 1)
      activity.add(false)
      setWrong([sel.key, t.key])
      setSel(null)
      setTimeout(() => setWrong([]), 380)
    }
  }

  function again() {
    setTiles(makeTiles(cards)); setGone(new Set()); setSel(null); setMistakes(0); setElapsed(0)
    start.current = Date.now()
  }

  return (
    <div className="page study">
      <div className="row spread">
        <Link to={`/set/${set.id}`} className="btn ghost sm">✕ יציאה</Link>
        <b>התאמה</b>
        <span className="muted">{fmtTime(elapsed)}</span>
      </div>
      <p className="muted small mt-s">התאם מושג להגדרה שלו. טעות מוסיפה שנייה. {best !== null && <>שיא: <b>{fmtTime(best)}</b></>}</p>

      {finished ? (
        <div className="index-card center mt" style={{ padding: '58px 16px 20px' }}>
          <h1>{fmtTime(elapsed)}</h1>
          <p className="muted">{mistakes} טעויות{best !== null && elapsed <= best ? ' · שיא חדש' : ''}</p>
          <div className="row mt-s" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={again}>שוב</button>
            <Link className="btn" to={`/set/${set.id}`}>לסט</Link>
          </div>
        </div>
      ) : (
        <div className="tiles mt">
          {tiles.map((t) => (
            <button
              key={t.key}
              dir="auto"
              className={'tile' + (sel?.key === t.key ? ' sel' : '') + (wrong.includes(t.key) ? ' wrong' : '') + (gone.has(t.cardId) ? ' gone' : '')}
              onClick={() => tap(t)}
            >
              <Rich text={t.text} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
