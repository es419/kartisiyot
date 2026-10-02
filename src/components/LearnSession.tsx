import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { saveProgress } from '../api'
import { useActivity } from '../hooks'
import { nextProgress } from '../lib/srs'
import { grade, shuffle, type Verdict } from '../lib/text'
import { speak } from '../lib/tts'
import Rich from './Rich'
import Icon from './Icon'
import { aiFallbackText } from './AiNote'
import TopBar from './TopBar'
import { aiGrade } from '../ai'
import { gradeWith } from '../lib/grading'
import type { Card, Level, Progress } from '../types'

type Props = {
  cards: Card[]
  progress: Record<string, Progress>
  mode: 'learn' | 'write' | 'review'
  title: string
  backTo: string
  termLang?: string
  defLang?: string
  grading?: Level | ((c: Card) => Level)
}

type Result = { ok: boolean; verdict: Verdict; given: string; prev?: Progress; ai?: boolean; aiChecked?: boolean; aiFail?: string }

export default function LearnSession({ cards, progress, mode, title, backTo, termLang = 'en-US', defLang = 'he-IL', grading = 'flexible' }: Props) {
  const levelOf = (c: Card): Level => c.grading ?? (typeof grading === 'function' ? grading(c) : grading)
  const [dir, setDir] = useState<'td' | 'dt'>('td')
  const byId = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards])
  const prog = useRef<Record<string, Progress>>({ ...progress })
  const activity = useActivity()

  const initQueue = () =>
    shuffle(cards)
      .sort((a, b) => (prog.current[a.id]?.box ?? 0) - (prog.current[b.id]?.box ?? 0))
      .map((c) => c.id)

  const [queue, setQueue] = useState<string[]>(initQueue)
  const [struggled, setStruggled] = useState<Set<string>>(new Set())
  const [res, setRes] = useState<Result | null>(null)
  const [input, setInput] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [checking, setChecking] = useState(false)

  const cur = byId[queue[0]] as Card | undefined
  const promptOf = (c: Card) => (dir === 'td' ? c.term : c.definition)
  const ansOf = (c: Card) => (dir === 'td' ? c.definition : c.term)
  const promptLang = dir === 'td' ? termLang : defLang
  const ansLang = dir === 'td' ? defLang : termLang

  const kind: 'mc' | 'write' | null = !cur
    ? null
    : mode === 'write'
      ? 'write'
      : cards.length >= 4 && (prog.current[cur.id]?.box ?? 0) < 2
        ? 'mc'
        : 'write'

  const options = useMemo(() => {
    if (!cur || kind !== 'mc') return []
    const seen = new Set([ansOf(cur)])
    const others: string[] = []
    for (const c of shuffle(cards)) {
      const a = ansOf(c)
      if (!seen.has(a)) { seen.add(a); others.push(a) }
      if (others.length === 3) break
    }
    return shuffle([ansOf(cur), ...others])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id, dir, round])

  function record(ok: boolean, prev: Progress | undefined) {
    if (!cur) return
    const np = nextProgress(prev, ok, cur.id, cur.set_id)
    prog.current[cur.id] = np
    saveProgress(np).catch(() => {})
  }

  async function submit(given: string) {
    if (!cur || res || checking) return
    const expected = ansOf(cur)
    const level = levelOf(cur)
    let verdict: Verdict = kind === 'mc' ? (given === expected ? 'yes' : 'no') : gradeWith(level, given, expected, dir === 'td' ? cur.alts : undefined)
    let ai = false
    let aiFail: string | undefined
    let aiChecked = false
    if (verdict === 'no' && kind === 'write' && given.trim().length > 1 && level === 'smart') {
      setChecking(true)
      try {
        const [v] = await aiGrade([{ q: promptOf(cur), expected, given }])
        aiChecked = true
        if (v && v !== 'no') { verdict = v; ai = true }
      } catch (e) { aiFail = aiFallbackText((e as Error).message) }
      setChecking(false)
    }
    const ok = verdict !== 'no'
    const prev = prog.current[cur.id]
    record(ok, prev)
    activity.add(ok)
    if (!ok) setStruggled((s) => new Set(s).add(cur.id))
    setRes({ ok, verdict, given, prev, ai, aiChecked, aiFail })
  }

  function override() {
    if (!cur || !res || res.ok) return
    record(true, res.prev)
    setStruggled((s) => { const n = new Set(s); n.delete(cur.id); return n })
    setRes({ ...res, ok: true, verdict: 'yes' })
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
    setPicked(null)
    setRound((r) => r + 1)
  }

  useEffect(() => {
    if (queue.length === 0) activity.flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (res && e.key === 'Enter') { e.preventDefault(); next() }
      else if (!res && kind === 'mc' && /^[1-4]$/.test(e.key)) {
        const o = options[Number(e.key) - 1]
        if (o !== undefined) { setPicked(o); submit(o) }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  function again(onlyHard: boolean) {
    const ids = onlyHard ? [...struggled] : cards.map((c) => c.id)
    setStruggled(new Set())
    setQueue(shuffle(ids))
  }

  if (!cur) {
    return (
      <div className="page study">
        <TopBar close={backTo} title={mode === 'review' ? 'סיימת את החזרה' : 'סיימת את הסט'} />
        <p className="muted mt-s">{cards.length - struggled.size} מתוך {cards.length} נכונות בניסיון הראשון.</p>
        {struggled.size > 0 && (
          <div className="col mt">
            <h3>כדאי לחזור על</h3>
            {[...struggled].map((id) => (
              <div key={id} className="entry">
                <b dir="auto"><Rich text={byId[id].term} /></b>
                <div className="muted" dir="auto"><Rich text={byId[id].definition} /></div>
              </div>
            ))}
          </div>
        )}
        <div className="col mt">
          {struggled.size > 0 && mode !== 'review' && <button className="btn primary" onClick={() => again(true)}>סבב על הקשות</button>}
          {mode !== 'review' && <button className="btn" onClick={() => again(false)}>מההתחלה</button>}
          <Link className="btn ghost" to={backTo}>סיום</Link>
        </div>
      </div>
    )
  }

  const mastered = cards.length - queue.length

  return (
    <div className="page study">
      <TopBar
        close={backTo}
        title={title}
        right={<button className={'icon-btn' + (dir === 'dt' ? ' on' : '')} aria-label="החלף כיוון" onClick={() => !res && setDir(dir === 'td' ? 'dt' : 'td')}><Icon name="swap" size={21} /></button>}
      />
      <div className="progress"><i style={{ width: `${(mastered / cards.length) * 100}%` }} /></div>
      <p className="muted small mt-s">{mastered} מתוך {cards.length} נקלטו</p>

      <div className="index-card q-card mt" style={{ position: 'relative' }}>
        <button className="icon-btn" style={{ position: 'absolute', top: 4, insetInlineStart: 6 }} aria-label="השמע" onClick={() => speak(promptOf(cur), promptLang)}><Icon name="speaker" size={21} /></button>
        {dir === 'td' && cur.image_url && <img className="q-img" src={cur.image_url} alt="" />}
        <div className="q-prompt" dir="auto"><Rich text={promptOf(cur)} /></div>

        {kind === 'mc' && (
          <div className="opts">
            {options.map((o, i) => {
              const isAns = o === ansOf(cur)
              const cls = res ? (isAns ? ' good' : picked === o ? ' bad' : '') : ''
              return (
                <button key={i} className={'opt' + cls} disabled={!!res} dir="auto" onClick={() => { setPicked(o); submit(o) }}>
                  <span className="muted small">{i + 1}. </span><Rich text={o} />
                </button>
              )
            })}
          </div>
        )}

        {kind === 'write' && (
          <form className="col mt-s" onSubmit={(e) => { e.preventDefault(); if (!res) submit(input) }}>
            <input className="input" autoFocus onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })} autoCapitalize="off" autoCorrect="off" spellCheck={false} dir="auto" placeholder="הקלד תשובה" value={input} readOnly={!!res} onChange={(e) => setInput(e.target.value)} />
            {!res && (
              <div className="row">
                <button className="btn primary grow" disabled={checking}>{checking ? 'בודק…' : 'בדוק'}</button>
                <button type="button" className="btn" onClick={() => submit('')}>לא יודע</button>
              </div>
            )}
          </form>
        )}

        {res && (
          <div className={'feedback ' + (res.ok ? 'good' : 'bad')}>
            {res.ok ? (res.ai ? 'נכון לפי המשמעות' : res.verdict === 'close' ? 'כמעט מדויק, נספר כנכון' : 'נכון') : 'לא נכון'}
            {(!res.ok || res.verdict === 'close' || res.ai) && <div className="answer-line" dir="auto">התשובה: <Rich text={ansOf(cur)} /></div>}
            {res.aiFail && <div className="small muted mt-s">{res.aiFail}</div>}
            {res.aiChecked && !res.ai && <div className="small muted mt-s">ה-AI בדק גם את התשובה שלך ופסל אותה.</div>}
            <div className="row mt-s">
              <button className="btn primary grow" autoFocus onClick={next}>המשך</button>
              {!res.ok && kind === 'write' && res.given.trim() && <button className="btn" onClick={override}>צדקתי</button>}
              <button className="icon-btn" aria-label="השמע תשובה" onClick={() => speak(ansOf(cur), ansLang)}><Icon name="speaker" size={21} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
