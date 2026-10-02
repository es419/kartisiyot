import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useActivity, useStudy, useViewportHeight } from '../hooks'
import Rich from '../components/Rich'
import TopBar from '../components/TopBar'
import { ErrorBox, Loading } from '../components/ui'
import { aiGrade } from '../ai'
import { gradeWith } from '../lib/grading'
import { normalize, shuffle, type Verdict } from '../lib/text'
import type { Card, Level, SetRow } from '../types'

type Rock = { id: number; card: Card; x: number; y: number; v: number }

export default function Gravity() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { data, error, loading } = useStudy(id!, sp.get('starred') === '1')
  if (loading && !data) return <div className="page"><Loading /></div>
  if (error && !data) return <div className="page"><ErrorBox msg={error} /></div>
  if (!data) return null
  return <Game set={data.set} cards={data.cards} />
}

function Game({ set, cards }: { set: SetRow; cards: Card[] }) {
  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [rocks, setRocks] = useState<Rock[]>([])
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [input, setInput] = useState('')
  const [missed, setMissed] = useState<Card[]>([])
  const [flash, setFlash] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const paused = useRef(false)
  const level = (set.grading ?? 'flexible') as Level
  const activity = useActivity()
  const vh = useViewportHeight()
  const skyH = Math.max(220, Math.min(520, vh - 230))

  const rocksRef = useRef<Rock[]>([])
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const queue = useRef<Card[]>([])
  const nextId = useRef(1)
  const lastSpawn = useRef(0)
  const lastT = useRef(0)
  const missedRef = useRef<Card[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  function begin() {
    rocksRef.current = []
    scoreRef.current = 0
    livesRef.current = 3
    missedRef.current = []
    queue.current = shuffle(cards)
    lastSpawn.current = 0
    lastT.current = 0
    setRocks([]); setScore(0); setLives(3); setMissed([]); setInput(''); setFlash(null)
    setPhase('play')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    const tick = (t: number) => {
      if (!lastT.current) { lastT.current = t; lastSpawn.current = t - 1500 }
      if (paused.current) {
        // המשחק מושהה בזמן שה-AI בודק תשובה
        lastSpawn.current += t - lastT.current
        lastT.current = t
        raf = requestAnimationFrame(tick)
        return
      }
      const dt = Math.min(64, t - lastT.current)
      lastT.current = t
      const level = Math.floor(scoreRef.current / 5)
      const speed = 0.009 + level * 0.0018
      const gap = Math.max(1300, 3400 - level * 260)

      if (t - lastSpawn.current > gap) {
        lastSpawn.current = t
        if (queue.current.length === 0) queue.current = shuffle(cards)
        const card = queue.current.pop()!
        rocksRef.current.push({ id: nextId.current++, card, x: 4 + Math.random() * 54, y: -8, v: speed * (0.9 + Math.random() * 0.3) })
      }

      const alive: Rock[] = []
      for (const r of rocksRef.current) {
        r.y += r.v * dt
        if (r.y >= 88) {
          livesRef.current -= 1
          missedRef.current.push(r.card)
          activity.add(false)
          setLives(livesRef.current)
          setFlash(r.card.term)
          setTimeout(() => setFlash(null), 1400)
        } else alive.push(r)
      }
      rocksRef.current = alive
      setRocks(alive.map((r) => ({ ...r })))

      if (livesRef.current <= 0) {
        setMissed([...missedRef.current])
        activity.flush()
        setPhase('over')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function hit(r: Rock) {
    rocksRef.current = rocksRef.current.filter((x) => x.id !== r.id)
    scoreRef.current += 1
    setScore(scoreRef.current)
    activity.add(true)
    setInput('')
  }

  function onChange(v: string) {
    setInput(v)
    const n = normalize(v)
    if (!n) return
    const sorted = [...rocksRef.current].sort((a, b) => b.y - a.y)
    const found = sorted.find((r) => normalize(r.card.term) === n)
    if (found) hit(found)
  }

  async function onEnter() {
    if (checking) return
    const typed = input
    const sorted = [...rocksRef.current].sort((a, b) => b.y - a.y)
    const lvl = (c: Card): Level => c.grading ?? level
    let found = sorted.find((r) => gradeWith(lvl(r.card), typed, r.card.term, undefined) !== 'no')
    const smart = sorted.filter((r) => lvl(r.card) === 'smart')
    if (!found && smart.length && typed.trim().length > 1) {
      paused.current = true
      setChecking(true)
      try {
        const items = smart.map((r) => ({ q: r.card.definition, expected: r.card.term, given: typed }))
        const timeout = new Promise<Verdict[]>((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
        const v = await Promise.race([aiGrade(items), timeout])
        const i = v.findIndex((x) => x !== 'no')
        if (i >= 0) found = smart[i]
      } catch { /* נשארים עם הבדיקה הגמישה */ }
      paused.current = false
      setChecking(false)
    }
    if (found && rocksRef.current.some((r) => r.id === found!.id)) hit(found)
    else setInput('')
  }

  return (
    <div className="page study">
      <TopBar
        close={`/set/${set.id}`}
        title="כבידה"
        right={<span className="pill">{'♥'.repeat(Math.max(0, lives))}{'♡'.repeat(Math.max(0, 3 - lives))} · {score}</span>}
      />

      {phase === 'ready' && (
        <div className="index-card center mt" style={{ padding: '24px 18px' }}>
          <h2>הקלד את המושג לפני שההגדרה נופלת</h2>
          <p className="muted mt-s">יש לך 3 חיים. ככל שתצבור נקודות המשחק מהיר יותר.</p>
          <button className="btn primary mt" onClick={begin}>התחל</button>
        </div>
      )}

      {phase === 'play' && (
        <>
          <div className="sky mt" aria-live="off" style={{ height: skyH, minHeight: 0 }}>
            {rocks.map((r) => (
              <div key={r.id} className="rock" dir="auto" style={{ top: `${r.y}%`, insetInlineStart: `${r.x}%` }}><Rich text={r.card.definition} /></div>
            ))}
            {flash && <div className="flash-miss" dir="auto">היה: {flash}</div>}
            <div className="ground" />
          </div>
          <form className="row mt-s" onSubmit={(e) => { e.preventDefault(); onEnter() }}>
            <input ref={inputRef} className="input" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} dir="auto" placeholder="הקלד מושג" value={input} readOnly={checking} onChange={(e) => onChange(e.target.value)} />
            <button className="btn primary" disabled={checking}>{checking ? 'בודק…' : 'שלח'}</button>
          </form>
        </>
      )}

      {phase === 'over' && (
        <div className="index-card center mt" style={{ padding: '24px 18px' }}>
          <h1>{score} נקודות</h1>
          {missed.length > 0 && (
            <div className="col mt" style={{ textAlign: 'start' }}>
              <h3>הפספסת</h3>
              {[...new Map(missed.map((c) => [c.id, c])).values()].map((c) => (
                <div key={c.id}><b dir="auto">{c.term}</b> <span className="muted" dir="auto">{c.definition}</span></div>
              ))}
            </div>
          )}
          <div className="row mt" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={begin}>שוב</button>
            <Link className="btn" to={`/set/${set.id}`}>לסט</Link>
          </div>
        </div>
      )}
    </div>
  )
}
