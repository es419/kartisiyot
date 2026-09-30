import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { saveProgress } from '../api'
import { useActivity, useStudy } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import { nextProgress } from '../lib/srs'
import { grade, shuffle } from '../lib/text'
import Rich from '../components/Rich'
import TopBar from '../components/TopBar'
import type { Card, Progress, SetRow } from '../types'

type Cfg = { count: number; mc: boolean; tf: boolean; write: boolean; match: boolean }
type Q = { id: string; kind: 'mc' | 'tf' | 'write'; card: Card; options?: string[]; shown?: string; isTrue?: boolean }
type Built = { qs: Q[]; matchCards: Card[]; matchDefs: string[] }

function build(cards: Card[], cfg: Cfg): Built {
  const pool = shuffle(cards)
  const matchN = cfg.match && pool.length >= 3 ? Math.min(6, Math.max(3, Math.floor(cfg.count / 4)), pool.length) : 0
  const matchCards = pool.slice(0, matchN)
  const rest = pool.slice(matchN, matchN + Math.max(0, cfg.count - matchN))
  const kinds: Q['kind'][] = []
  if (cfg.mc && cards.length >= 4) kinds.push('mc')
  if (cfg.tf && cards.length >= 2) kinds.push('tf')
  if (cfg.write) kinds.push('write')
  if (kinds.length === 0 && matchN === 0) kinds.push('write')
  const qs: Q[] = kinds.length === 0 ? [] : rest.map((card, i) => {
    const kind = kinds[i % kinds.length]
    const others = shuffle(cards.filter((c) => c.id !== card.id && c.definition !== card.definition))
    if (kind === 'mc') {
      const seen = new Set([card.definition])
      const opts = [card.definition]
      for (const o of others) if (!seen.has(o.definition)) { seen.add(o.definition); opts.push(o.definition); if (opts.length === 4) break }
      return { id: card.id, kind, card, options: shuffle(opts) }
    }
    if (kind === 'tf') {
      const isTrue = Math.random() < 0.5 || others.length === 0
      return { id: card.id, kind, card, isTrue, shown: isTrue ? card.definition : others[0].definition }
    }
    return { id: card.id, kind, card }
  })
  return { qs: shuffle(qs), matchCards, matchDefs: shuffle(matchCards.map((c) => c.definition)) }
}

export default function Test() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { data, error, loading } = useStudy(id!, sp.get('starred') === '1')
  if (loading && !data) return <div className="page"><Loading /></div>
  if (error && !data) return <div className="page"><ErrorBox msg={error} /></div>
  if (!data) return null
  return <TestRun set={data.set} cards={data.cards} progress={data.progress} />
}

function TestRun({ set, cards, progress }: { set: SetRow; cards: Card[]; progress: Record<string, Progress> }) {
  const [phase, setPhase] = useState<'config' | 'taking' | 'result'>('config')
  const [cfg, setCfg] = useState<Cfg>({ count: Math.min(20, cards.length), mc: true, tf: true, write: true, match: true })
  const [built, setBuilt] = useState<Built | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [matchAns, setMatchAns] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<Record<string, boolean>>({})
  const activity = useActivity()

  const total = useMemo(() => (built ? built.qs.length + built.matchCards.length : 0), [built])
  const correct = Object.values(outcome).filter(Boolean).length

  function start() {
    const b = build(cards, cfg)
    setBuilt(b); setAnswers({}); setMatchAns({}); setOutcome({}); setPhase('taking')
    window.scrollTo(0, 0)
  }

  function submit() {
    if (!built) return
    const out: Record<string, boolean> = {}
    for (const q of built.qs) {
      const a = answers[q.id] ?? ''
      if (q.kind === 'mc') out[q.id] = a === q.card.definition
      else if (q.kind === 'tf') out[q.id] = a !== '' && (a === 'true') === q.isTrue
      else out[q.id] = grade(a, q.card.definition) !== 'no'
    }
    for (const c of built.matchCards) out[c.id] = matchAns[c.id] === c.definition
    setOutcome(out)
    for (const [cardId, ok] of Object.entries(out)) {
      const np = nextProgress(progress[cardId], ok, cardId, set.id)
      progress[cardId] = np
      saveProgress(np).catch(() => {})
      activity.add(ok)
    }
    activity.flush()
    setPhase('result')
    window.scrollTo(0, 0)
  }

  if (phase === 'config') {
    const toggle = (k: 'mc' | 'tf' | 'write' | 'match') => setCfg({ ...cfg, [k]: !cfg[k] })
    return (
      <div className="page study">
        <TopBar close={`/set/${set.id}`} title="הגדרות מבחן" />
        <div className="col mt">
          <label className="field">מספר שאלות (עד {cards.length})
            <input className="input" type="number" min={1} max={cards.length} value={cfg.count} onChange={(e) => setCfg({ ...cfg, count: Math.max(1, Math.min(cards.length, Number(e.target.value) || 1)) })} />
          </label>
          <div className="row wrap">
            <button className={'chip' + (cfg.mc ? ' on' : '')} onClick={() => toggle('mc')}>רב-ברירה</button>
            <button className={'chip' + (cfg.tf ? ' on' : '')} onClick={() => toggle('tf')}>נכון/לא נכון</button>
            <button className={'chip' + (cfg.write ? ' on' : '')} onClick={() => toggle('write')}>כתיבה</button>
            <button className={'chip' + (cfg.match ? ' on' : '')} onClick={() => toggle('match')}>התאמה</button>
          </div>
          {cards.length < 4 && <p className="muted small">בסט קטן מ-4 כרטיסיות רב-ברירה לא זמין.</p>}
          <button className="btn primary" onClick={start}>התחל מבחן</button>
        </div>
      </div>
    )
  }

  if (!built) return null
  const done = phase === 'result'

  return (
    <div className="page study">
      <TopBar close={`/set/${set.id}`} title={done ? `תוצאות: ${correct}/${total}` : 'מבחן'} />

      {done && (
        <div className="index-card center mt" style={{ padding: '24px 18px' }}>
          <h1>{Math.round((correct / Math.max(1, total)) * 100)}%</h1>
          <p className="muted">{correct} מתוך {total} נכונות</p>
          <div className="row mt-s" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => setPhase('config')}>מבחן חדש</button>
          </div>
        </div>
      )}

      <div className="col mt">
        {built.qs.map((q, i) => {
          const ok = outcome[q.id]
          const status = done ? (ok ? 'good' : 'bad') : ''
          return (
            <div key={q.id} className="entry" style={done ? { borderColor: ok ? 'var(--good)' : 'var(--bad)' } : undefined}>
              <span className="badge">{i + 1}</span>
              <p className="q-prompt mt-s" dir="auto"><Rich text={q.card.term} /></p>
              {q.card.image_url && <img className="q-img" src={q.card.image_url} alt="" />}

              {q.kind === 'mc' && (
                <div className="opts">
                  {q.options!.map((o, k) => {
                    const chosen = answers[q.id] === o
                    let cls = ''
                    if (done) cls = o === q.card.definition ? ' good' : chosen ? ' bad' : ''
                    else if (chosen) cls = ' good'
                    return <button key={k} className={'opt' + cls} disabled={done} dir="auto" onClick={() => setAnswers({ ...answers, [q.id]: o })}><Rich text={o} /></button>
                  })}
                </div>
              )}

              {q.kind === 'tf' && (
                <>
                  <p className="mt-s" dir="auto">האם ההגדרה היא: <b><Rich text={q.shown ?? ''} /></b></p>
                  <div className="row mt-s">
                    {(['true', 'false'] as const).map((v) => {
                      const chosen = answers[q.id] === v
                      let cls = ''
                      if (done) cls = (v === 'true') === q.isTrue ? ' good' : chosen ? ' bad' : ''
                      else if (chosen) cls = ' good'
                      return <button key={v} className={'opt grow' + cls} disabled={done} onClick={() => setAnswers({ ...answers, [q.id]: v })}>{v === 'true' ? 'נכון' : 'לא נכון'}</button>
                    })}
                  </div>
                </>
              )}

              {q.kind === 'write' && (
                <input className="input mt-s" dir="auto" autoCapitalize="off" spellCheck={false} placeholder="הקלד את ההגדרה" value={answers[q.id] ?? ''} readOnly={done} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              )}

              {done && !ok && <div className={'feedback ' + status}>התשובה הנכונה: <span className="answer-line" dir="auto"><Rich text={q.card.definition} /></span></div>}
            </div>
          )
        })}

        {built.matchCards.length > 0 && (
          <div className="entry">
            <h3>התאמה: בחר את ההגדרה לכל מושג</h3>
            <div className="col mt-s">
              {built.matchCards.map((c) => {
                const ok = outcome[c.id]
                return (
                  <div key={c.id}>
                    <b dir="auto"><Rich text={c.term} /></b>
                    <select className="select mt-s" disabled={done} value={matchAns[c.id] ?? ''} onChange={(e) => setMatchAns({ ...matchAns, [c.id]: e.target.value })} style={done ? { borderColor: ok ? 'var(--good)' : 'var(--bad)' } : undefined}>
                      <option value="">בחר…</option>
                      {built.matchDefs.map((d, k) => <option key={k} value={d}>{d.length > 80 ? d.slice(0, 80) + '…' : d}</option>)}
                    </select>
                    {done && !ok && <div className="feedback bad">התשובה הנכונה: <span className="answer-line" dir="auto"><Rich text={c.definition} /></span></div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {!done && <button className="btn primary block mt" onClick={submit}>סיים ובדוק</button>}
    </div>
  )
}
