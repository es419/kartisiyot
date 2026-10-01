import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { saveProgress } from '../api'
import { useActivity, useStudy } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import Icon from '../components/Icon'
import TopBar from '../components/TopBar'
import { nextProgress } from '../lib/srs'
import { grade, shuffle, type Verdict } from '../lib/text'
import { speak } from '../lib/tts'
import type { Card, Progress, SetRow } from '../types'

export default function Spell() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { data, error, loading } = useStudy(id!, sp.get('starred') === '1')
  if (loading && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><Loading /></div>
  if (error && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><ErrorBox msg={error} /></div>
  if (!data) return null
  const pool = data.cards.filter((c) => !c.full) // כרטיסיות השלמה לא מתאימות לאיות
  if (pool.length === 0) return <div className="page study"><TopBar close={`/set/${id}`} /><div className="empty">אין מושגים מתאימים לאיות בסט.</div></div>
  return <Session set={data.set} cards={pool} progress={data.progress} />
}

function Diff({ expected, given }: { expected: string; given: string }) {
  const g = [...given.trim()]
  return (
    <span dir="ltr" style={{ fontWeight: 700, letterSpacing: '.04em' }}>
      {[...expected].map((ch, i) => (
        <span key={i} style={{ color: g[i]?.toLowerCase() === ch.toLowerCase() ? 'var(--good)' : 'var(--bad)' }}>{ch}</span>
      ))}
    </span>
  )
}

function Session({ set, cards, progress }: { set: SetRow; cards: Card[]; progress: Record<string, Progress> }) {
  const byId = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards])
  const prog = useRef({ ...progress })
  const activity = useActivity()
  const [started, setStarted] = useState(false)
  const [queue, setQueue] = useState<string[]>(() => shuffle(cards.map((c) => c.id)))
  const [input, setInput] = useState('')
  const [res, setRes] = useState<{ ok: boolean; verdict: Verdict; given: string } | null>(null)
  const [hint, setHint] = useState(false)
  const [struggled, setStruggled] = useState<Set<string>>(new Set())
  const cur = byId[queue[0]] as Card | undefined

  useEffect(() => {
    if (started && cur && !res) speak(cur.term, set.term_lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, cur?.id])

  useEffect(() => {
    if (queue.length === 0) activity.flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length])

  function submit() {
    if (!cur || res) return
    const verdict = grade(input, cur.term)
    const ok = verdict !== 'no'
    const np = nextProgress(prog.current[cur.id], ok, cur.id, set.id)
    prog.current[cur.id] = np
    saveProgress(np).catch(() => {})
    activity.add(ok)
    if (!ok) setStruggled((s) => new Set(s).add(cur.id))
    setRes({ ok, verdict, given: input })
  }

  function next() {
    if (!res) return
    setQueue((q) => {
      const [head, ...rest] = q
      if (res.ok) return rest
      rest.splice(Math.min(3, rest.length), 0, head)
      return rest
    })
    setRes(null)
    setInput('')
    setHint(false)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (res && e.key === 'Enter') { e.preventDefault(); next() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  if (!started) {
    return (
      <div className="page study">
        <TopBar close={`/set/${set.id}`} title="איות" />
        <div className="index-card center mt" style={{ padding: '28px 20px' }}>
          <Icon name="spell" size={44} />
          <h2 className="mt-s">שמע והקלד</h2>
          <p className="muted mt-s">תשמע מילה ותקליד אותה בלי לראות אותה. ההקראה בשפת המושג של הסט, וההגדרה נכנסת בעריכה.</p>
          <button className="btn primary mt" onClick={() => { setStarted(true); speak('', set.term_lang) }}>התחל</button>
        </div>
      </div>
    )
  }

  if (!cur) {
    return (
      <div className="page study">
        <TopBar close={`/set/${set.id}`} title="סיימת" />
        <p className="muted mt">{cards.length - struggled.size} מתוך {cards.length} נכונות בניסיון הראשון.</p>
        {struggled.size > 0 && (
          <div className="list mt">
            {[...struggled].map((id) => (
              <div key={id} className="list-row term"><div className="tx"><b dir="ltr">{byId[id].term}</b></div></div>
            ))}
          </div>
        )}
        <div className="col mt">
          {struggled.size > 0 && <button className="btn primary" onClick={() => { setQueue(shuffle([...struggled])); setStruggled(new Set()) }}>עוד סבב על הקשות</button>}
          <button className="btn" onClick={() => { setQueue(shuffle(cards.map((c) => c.id))); setStruggled(new Set()) }}>מההתחלה</button>
          <Link className="btn ghost" to={`/set/${set.id}`}>חזרה לסט</Link>
        </div>
      </div>
    )
  }

  const len = [...cur.term].length
  return (
    <div className="page study">
      <TopBar close={`/set/${set.id}`} title="איות" right={<span className="pill" dir="ltr">{cards.length - queue.length} / {cards.length}</span>} />
      <div className="progress"><i style={{ width: `${((cards.length - queue.length) / cards.length) * 100}%` }} /></div>

      <div className="index-card center mt" style={{ padding: '26px 20px' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
          <button className="round good" aria-label="השמע" onClick={() => speak(cur.term, set.term_lang)}><Icon name="speaker" size={30} /></button>
          <button className="btn sm" onClick={() => speak(cur.term, set.term_lang, 0.55)}>לאט</button>
        </div>
        {hint && <p className="muted mt-s" dir="ltr">{cur.term[0]}{' _'.repeat(Math.max(0, len - 1))} ({len})</p>}

        <form className="col mt" onSubmit={(e) => { e.preventDefault(); submit() }}>
          <input className="input" dir="ltr" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="הקלד את מה ששמעת" value={input} readOnly={!!res} onChange={(e) => setInput(e.target.value)} />
          {!res && (
            <div className="row">
              <button className="btn primary grow">בדוק</button>
              <button type="button" className="btn" onClick={() => setHint(true)}>רמז</button>
            </div>
          )}
        </form>

        {res && (
          <div className={'feedback ' + (res.ok ? 'good' : 'bad')} style={{ textAlign: 'start' }}>
            {res.ok ? (res.verdict === 'close' ? 'כמעט מדויק, נספר כנכון' : 'נכון') : 'לא נכון'}
            {(!res.ok || res.verdict === 'close') && <div className="mt-s">האיות הנכון: <Diff expected={cur.term} given={res.given} /></div>}
            <div className="muted small mt-s" dir="auto">{cur.definition}</div>
            <button className="btn primary block mt-s" autoFocus onClick={next}>המשך</button>
          </div>
        )}
      </div>
    </div>
  )
}
