import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useStudy } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import Rich from '../components/Rich'
import Icon from '../components/Icon'
import TopBar from '../components/TopBar'
import { shuffle } from '../lib/text'
import type { Card, SetRow } from '../types'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function say(text: string, lang: string, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !text.trim()) return resolve()
    const u = new SpeechSynthesisUtterance(text.replace(/\[\.\.\.\]/g, ' ... '))
    u.lang = lang
    u.rate = rate
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

export default function Listen() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { data, error, loading } = useStudy(id!, sp.get('starred') === '1')
  if (loading && !data) return <div className="page"><Loading /></div>
  if (error && !data) return <div className="page"><ErrorBox msg={error} /></div>
  if (!data) return null
  return <Player set={data.set} cards={data.cards} />
}

function Player({ set, cards }: { set: SetRow; cards: Card[] }) {
  const [shuffled, setShuffled] = useState(false)
  const deck = useMemo(() => (shuffled ? shuffle(cards) : cards), [cards, shuffled])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [phase, setPhase] = useState<'term' | 'def'>('term')
  const [rate, setRate] = useState(1)
  const [pause, setPause] = useState(3)
  const [loop, setLoop] = useState(true)
  const c = deck[idx]

  useEffect(() => {
    if (!playing) return
    let cancelled = false
    ;(async () => {
      setPhase('term')
      await say(c.term, set.term_lang, rate)
      if (cancelled) return
      await sleep(pause * 1000)
      if (cancelled) return
      setPhase('def')
      await say(c.definition, set.def_lang, rate)
      if (cancelled) return
      await sleep(1200)
      if (cancelled) return
      if (idx + 1 < deck.length) setIdx(idx + 1)
      else if (loop) setIdx(0)
      else setPlaying(false)
    })()
    return () => {
      cancelled = true
      window.speechSynthesis?.cancel()
    }
  }, [playing, idx, deck, rate, pause, loop, set.term_lang, set.def_lang, c])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const go = (d: number) => setIdx((i) => (i + d + deck.length) % deck.length)

  return (
    <div className="page study">
      <TopBar close={`/set/${set.id}`} title="האזנה" right={<span className="pill" dir="ltr">{idx + 1} / {deck.length}</span>} />
      <div className="progress"><i style={{ width: `${((idx + 1) / deck.length) * 100}%` }} /></div>

      <div className="index-card now-playing mt" style={{ position: 'relative' }}>
        <div className={'term' + (playing && phase === 'def' ? ' dim' : '')} dir="auto"><Rich text={c.term} /></div>
        <div className={'def' + (playing && phase === 'term' ? ' dim' : '')} dir="auto"><Rich text={c.definition} /></div>
      </div>

      <div className="row mt" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={() => go(-1)} aria-label="הקודם"><Icon name="prev" size={22} fill /></button>
        <button className="btn primary" style={{ minWidth: 120 }} onClick={() => setPlaying(!playing)}><Icon name={playing ? 'pause' : 'play'} size={20} fill={!playing} /> {playing ? 'השהה' : 'נגן'}</button>
        <button className="btn" onClick={() => go(1)} aria-label="הבא"><Icon name="next" size={22} fill /></button>
      </div>

      <div className="col mt">
        <div className="row wrap">
          <span className="muted small">מהירות</span>
          {[0.8, 1, 1.2].map((r) => <button key={r} className={'chip' + (rate === r ? ' on' : '')} onClick={() => setRate(r)}>{r}x</button>)}
        </div>
        <div className="row wrap">
          <span className="muted small">השהיה לפני ההגדרה</span>
          {[2, 4, 6].map((p) => <button key={p} className={'chip' + (pause === p ? ' on' : '')} onClick={() => setPause(p)}>{p} שנ׳</button>)}
        </div>
        <div className="row wrap">
          <button className={'chip' + (shuffled ? ' on' : '')} onClick={() => { setShuffled(!shuffled); setIdx(0) }}>ערבוב</button>
          <button className={'chip' + (loop ? ' on' : '')} onClick={() => setLoop(!loop)}>חזרה בלולאה</button>
        </div>
        <p className="muted small">בזמן ההשהיה נסה להגיד את ההגדרה לפני שהיא מוקראת. ההקראה נעצרת כשהמסך ננעל, ושפות ההקראה נקבעות בעריכת הסט.</p>
      </div>
    </div>
  )
}
