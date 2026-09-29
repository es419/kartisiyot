import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { saveProgress, updateCard } from '../api'
import { useActivity, useStudy } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import { nextProgress } from '../lib/srs'
import Rich from '../components/Rich'
import { shuffle } from '../lib/text'
import { speak } from '../lib/tts'
import type { Card, Progress, SetRow } from '../types'

export default function Flashcards() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { data, error, loading } = useStudy(id!, sp.get('starred') === '1')
  if (loading && !data) return <div className="page"><Loading /></div>
  if (error && !data) return <div className="page"><ErrorBox msg={error} /></div>
  if (!data) return null
  if (data.cards.length === 0) return <div className="page"><div className="empty">אין כרטיסיות ללימוד.</div><Link className="btn mt" to={`/set/${id}`}>חזרה</Link></div>
  return <Session set={data.set} cards={data.cards} progress={data.progress} />
}

function Session({ set, cards, progress }: { set: SetRow; cards: Card[]; progress: Record<string, Progress> }) {
  const [deck, setDeck] = useState<Card[]>(cards)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<string[]>([])
  const [unknown, setUnknown] = useState<Card[]>([])
  const [swap, setSwap] = useState(false)
  const [stars, setStars] = useState<Record<string, boolean>>(Object.fromEntries(cards.map((c) => [c.id, c.starred])))
  const prog = useRef(progress)
  const activity = useActivity()
  const touch = useRef<{ x: number; y: number } | null>(null)
  const done = idx >= deck.length
  const card = deck[idx]

  function mark(ok: boolean) {
    if (!card) return
    const np = nextProgress(prog.current[card.id], ok, card.id, set.id)
    prog.current[card.id] = np
    saveProgress(np).catch(() => {})
    activity.add(ok)
    if (ok) setKnown((k) => [...k, card.id])
    else setUnknown((u) => [...u, card])
    setFlipped(false)
    setIdx((i) => i + 1)
  }

  useEffect(() => {
    if (done) activity.flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (done) return
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f) }
      else if (e.key === 'ArrowRight') mark(true)
      else if (e.key === 'ArrowLeft') mark(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  function restart(list: Card[], doShuffle = false) {
    setDeck(doShuffle ? shuffle(list) : list)
    setIdx(0); setKnown([]); setUnknown([]); setFlipped(false)
  }

  async function toggleStar() {
    const v = !stars[card.id]
    setStars({ ...stars, [card.id]: v })
    updateCard(card.id, { starred: v }).catch(() => {})
  }

  if (done) {
    return (
      <div className="page study">
        <h1>סיימת את הסבב</h1>
        <div className="stat-strip mt">
          <div className="stat"><b style={{ color: 'var(--good)' }}>{known.length}</b><span>ידעתי</span></div>
          <div className="stat"><b style={{ color: 'var(--bad)' }}>{unknown.length}</b><span>לא ידעתי</span></div>
        </div>
        <div className="col mt">
          {unknown.length > 0 && <button className="btn primary" onClick={() => restart(unknown, true)}>לעבור שוב על {unknown.length} שלא ידעתי</button>}
          <button className="btn" onClick={() => restart(cards, true)}>סבב חדש מעורבב</button>
          <Link className="btn ghost" to={`/set/${set.id}`}>חזרה לסט</Link>
        </div>
      </div>
    )
  }

  const front = swap ? card.definition : card.term
  const back = swap ? card.term : card.definition
  const frontLang = swap ? set.def_lang : set.term_lang
  const backLang = swap ? set.term_lang : set.def_lang

  return (
    <div className="page study">
      <div className="row spread">
        <Link to={`/set/${set.id}`} className="btn ghost sm">✕ יציאה</Link>
        <span className="muted">{idx + 1} / {deck.length}</span>
        <div className="row">
          <button className="btn sm" onClick={() => restart(deck, true)}>🔀</button>
          <button className={'btn sm' + (swap ? ' primary' : '')} onClick={() => setSwap(!swap)}>⇄</button>
        </div>
      </div>
      <div className="progress mt-s"><i style={{ width: `${(idx / deck.length) * 100}%` }} /></div>

      <div className="flash-wrap mt">
        <div
          className={'flash index-card' + (flipped ? ' flipped' : '')}
          onClick={() => setFlipped(!flipped)}
          onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
          onTouchEnd={(e) => {
            const t = touch.current
            if (!t) return
            const dx = e.changedTouches[0].clientX - t.x
            const dy = e.changedTouches[0].clientY - t.y
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) { e.preventDefault(); mark(dx > 0) }
          }}
        >
          <div className="face">
            <div className="corner">
              <button className={'icon-btn' + (stars[card.id] ? ' on' : '')} aria-label="כוכב" onClick={(e) => { e.stopPropagation(); toggleStar() }}>{stars[card.id] ? '★' : '☆'}</button>
              <button className="icon-btn" aria-label="השמע" onClick={(e) => { e.stopPropagation(); speak(front, frontLang) }}>🔊</button>
            </div>
            {!swap && card.image_url && <img src={card.image_url} alt="" />}
            <div className="txt" dir="auto"><Rich text={front} /></div>
          </div>
          <div className="face back">
            <div className="corner">
              <span />
              <button className="icon-btn" aria-label="השמע" onClick={(e) => { e.stopPropagation(); speak(back, backLang) }}>🔊</button>
            </div>
            {swap && card.image_url && <img src={card.image_url} alt="" />}
            <div className="txt" dir="auto"><Rich text={back} /></div>
            {!swap && card.full && <div className="muted small" dir="auto"><Rich text={card.full} /></div>}
          </div>
        </div>
      </div>
      <p className="muted small center mt-s">לחיצה להיפוך. החלקה ימינה = ידעתי, שמאלה = לא ידעתי.</p>

      <div className="row mt">
        <button className="btn danger grow" onClick={() => mark(false)}>✗ לא ידעתי</button>
        <button className="btn primary grow" onClick={() => mark(true)}>✓ ידעתי</button>
      </div>
    </div>
  )
}
