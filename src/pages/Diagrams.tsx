import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createDiagram, deleteDiagram, getDiagram, bumpActivity, updateDiagram, uploadImage } from '../api'
import { useLoad } from '../hooks'
import { ErrorBox, Loading, Modal } from '../components/ui'
import Icon from '../components/Icon'
import TopBar from '../components/TopBar'
import { resizeImage } from '../lib/image'
import { gradeWith } from '../lib/grading'
import { shuffle } from '../lib/text'
import type { Diagram, Point } from '../types'

/** יצירה / עריכה של תרשים: מעלים תמונה ולוחצים עליה כדי להוסיף נקודות עם תוויות */
export default function DiagramEditor() {
  const { id, did } = useParams()
  if (did === 'new') return <NewDiagram setId={id!} />
  return <Editor setId={id!} did={did!} />
}

function NewDiagram({ setId }: { setId: string }) {
  const nav = useNavigate()
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true)
    setErr(null)
    try {
      const url = await uploadImage(await resizeImage(f, 1400))
      const d = await createDiagram(setId, url)
      nav(`/set/${setId}/diagram/${d.id}`, { replace: true })
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="page study">
      <TopBar close={`/set/${setId}`} title="תרשים חדש" />
      <div className="index-card center mt" style={{ padding: '28px 20px' }}>
        <Icon name="pin" size={44} />
        <h2 className="mt-s">העלה תמונה או מפה</h2>
        <p className="muted mt-s">אחרי ההעלאה תלחץ על מקומות בתמונה ותתן להם שמות, ואחר כך אפשר לתרגל אותם.</p>
        {err && <div className="error mt-s">{err}</div>}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button className="btn primary mt" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'מעלה…' : 'בחר תמונה'}</button>
      </div>
    </div>
  )
}

function Editor({ setId, did }: { setId: string; did: string }) {
  const nav = useNavigate()
  const { data, error, loading } = useLoad(() => getDiagram(did), [did])
  const [points, setPoints] = useState<Point[]>([])
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (data) { setPoints(data.points ?? []); setTitle(data.title) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id])

  if (loading && !data) return <div className="page study"><TopBar back={`/set/${setId}`} /><Loading /></div>
  if (error && !data) return <div className="page study"><TopBar back={`/set/${setId}`} /><ErrorBox msg={error} /></div>
  if (!data) return null

  const save = (pts: Point[]) => {
    setPoints(pts)
    updateDiagram(did, { points: pts }).catch((e: Error) => setErr(e.message))
  }

  function addAt(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    const pts = [...points, { x, y, label: '' }]
    setPoints(pts)
    setEditing(pts.length - 1)
    setDraft('')
  }

  function commit() {
    if (editing === null) return
    const label = draft.trim()
    const pts = label ? points.map((p, i) => (i === editing ? { ...p, label } : p)) : points.filter((_, i) => i !== editing)
    setEditing(null)
    save(pts)
  }

  function removePoint() {
    if (editing === null) return
    const pts = points.filter((_, i) => i !== editing)
    setEditing(null)
    save(pts)
  }

  async function removeAll() {
    if (!confirm('למחוק את התרשים?')) return
    try {
      await deleteDiagram(did)
      nav(`/set/${setId}`, { replace: true })
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const labeled = points.filter((p) => p.label).length

  return (
    <div className="page study">
      <TopBar
        back={`/set/${setId}`}
        title="עריכת תרשים"
        right={labeled >= 2 ? <Link className="btn ghost sm" to={`/set/${setId}/diagram/${did}/practice`}>תרגול</Link> : undefined}
      />
      {err && <div className="error mb">{err}</div>}
      <input className="input" style={{ fontFamily: 'var(--display)', fontSize: 18 }} value={title} placeholder="שם התרשים" onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== data.title && updateDiagram(did, { title: title.trim() || 'תרשים' }).catch((e: Error) => setErr(e.message))} />
      <p className="muted small mt-s">לחץ על מקום בתמונה כדי להוסיף נקודה. לחיצה על נקודה קיימת לעריכה.</p>

      <div className="diagram mt-s" onClick={addAt}>
        <img src={data.image_url} alt="" draggable={false} />
        {points.map((p, i) => (
          <button
            key={i}
            className="pin"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            aria-label={p.label || 'נקודה'}
            onClick={(e) => { e.stopPropagation(); setEditing(i); setDraft(p.label) }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {points.length > 0 && (
        <div className="list mt">
          {points.map((p, i) => (
            <button key={i} className="list-row" onClick={() => { setEditing(i); setDraft(p.label) }}>
              <span className="ico" style={{ fontWeight: 700 }}>{i + 1}</span>
              <span className="tx"><b>{p.label || 'ללא שם'}</b></span>
            </button>
          ))}
        </div>
      )}

      <div className="col mt">
        {labeled >= 2 && <Link className="btn primary" to={`/set/${setId}/diagram/${did}/practice`}>תרגול</Link>}
        <button className="btn danger" onClick={removeAll}>מחק תרשים</button>
      </div>

      {editing !== null && (
        <Modal onClose={commit}>
          <form className="col" onSubmit={(e) => { e.preventDefault(); commit() }}>
            <h2>שם הנקודה {editing + 1}</h2>
            <input className="input" autoFocus dir="auto" placeholder="מה זה?" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="row">
              <button className="btn primary grow">שמור</button>
              <button type="button" className="btn danger" onClick={removePoint}>מחק נקודה</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

/** תרגול תרשים: "מה זה?" (לזהות נקודה) או "איפה?" (ללחוץ על המקום הנכון) */
export function DiagramPractice() {
  const { id, did } = useParams()
  const { data, error, loading } = useLoad(() => getDiagram(did!), [did])
  if (loading && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><Loading /></div>
  if (error && !data) return <div className="page study"><TopBar close={`/set/${id}`} /><ErrorBox msg={error} /></div>
  if (!data) return null
  const pts = (data.points ?? []).filter((p) => p.label)
  if (pts.length < 2) return <div className="page study"><TopBar close={`/set/${id}`} /><div className="empty">צריך לפחות 2 נקודות עם שם.</div></div>
  return <Practice setId={id!} diagram={data} points={pts} />
}

function Practice({ setId, diagram, points }: { setId: string; diagram: Diagram; points: Point[] }) {
  const [mode, setMode] = useState<'what' | 'where'>('what')
  const [queue, setQueue] = useState<number[]>(() => shuffle(points.map((_, i) => i)))
  const [res, setRes] = useState<{ ok: boolean; tap?: { x: number; y: number }; given?: string } | null>(null)
  const [input, setInput] = useState('')
  const [score, setScore] = useState({ ok: 0, total: 0 })
  const cur = queue[0] !== undefined ? points[queue[0]] : null
  const flushed = useRef(false)

  const options = useMemo(() => {
    if (cur === null || mode !== 'what' || points.length < 4) return []
    const others = shuffle(points.filter((p) => p.label !== cur.label).map((p) => p.label))
    return shuffle([cur.label, ...Array.from(new Set(others)).slice(0, 3)])
  }, [cur, mode, points])

  useEffect(() => {
    if (queue.length === 0 && !flushed.current && score.total > 0) {
      flushed.current = true
      bumpActivity(score.total, score.ok).catch(() => {})
    }
  }, [queue.length, score])

  function record(ok: boolean, extra: { tap?: { x: number; y: number }; given?: string } = {}) {
    setRes({ ok, ...extra })
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }))
  }

  function tapImage(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== 'where' || !cur || res) return
    const r = e.currentTarget.getBoundingClientRect()
    const cx = e.clientX - r.left
    const cy = e.clientY - r.top
    const dist = Math.hypot(cx - cur.x * r.width, cy - cur.y * r.height)
    record(dist <= Math.max(28, r.width * 0.07), { tap: { x: cx / r.width, y: cy / r.height } })
  }

  function answerWhat(label: string) {
    if (!cur || res) return
    record(label === cur.label, { given: label })
  }

  function submitTyped() {
    if (!cur || res) return
    record(gradeWith('flexible', input, cur.label) !== 'no', { given: input })
  }

  function next() {
    setQueue((q) => {
      const [h, ...rest] = q
      if (res && !res.ok) rest.splice(Math.min(2, rest.length), 0, h)
      return rest
    })
    setRes(null)
    setInput('')
  }

  function restart(m: 'what' | 'where') {
    setMode(m); setQueue(shuffle(points.map((_, i) => i))); setRes(null); setScore({ ok: 0, total: 0 }); flushed.current = false
  }

  const header = (
    <TopBar close={`/set/${setId}`} title={diagram.title} right={<span className="pill" dir="ltr">{points.length - queue.length} / {points.length}</span>} />
  )

  if (!cur) {
    return (
      <div className="page study">
        {header}
        <div className="index-card center mt" style={{ padding: '28px 20px' }}>
          <h1>{score.ok} / {score.total}</h1>
          <p className="muted mt-s">ענית נכון על {score.total ? Math.round((score.ok / score.total) * 100) : 0}% מהנקודות</p>
          <div className="col mt">
            <button className="btn primary" onClick={() => restart(mode)}>שוב</button>
            <button className="btn" onClick={() => restart(mode === 'what' ? 'where' : 'what')}>{mode === 'what' ? 'עבור ל"איפה?"' : 'עבור ל"מה זה?"'}</button>
            <Link className="btn ghost" to={`/set/${setId}`}>חזרה לסט</Link>
          </div>
        </div>
      </div>
    )
  }

  const showAll = false
  return (
    <div className="page study">
      {header}
      <div className="tabs">
        <button className={'chip' + (mode === 'what' ? ' on' : '')} onClick={() => restart('what')}>מה זה?</button>
        <button className={'chip' + (mode === 'where' ? ' on' : '')} onClick={() => restart('where')}>איפה?</button>
      </div>

      {mode === 'where' && (
        <div className="index-card center mt" style={{ padding: '14px 16px' }}>
          <span className="muted small">לחץ על:</span>
          <div className="q-prompt" dir="auto">{cur.label}</div>
        </div>
      )}

      <div className={'diagram mt-s' + (mode === 'where' && !res ? ' tappable' : '')} onClick={tapImage}>
        <img src={diagram.image_url} alt="" draggable={false} />
        {mode === 'what' && <span className={'pin pulse' + (res ? (res.ok ? ' good' : ' bad') : '')} style={{ left: `${cur.x * 100}%`, top: `${cur.y * 100}%` }}>?</span>}
        {mode === 'where' && res && (
          <>
            <span className="pin good" style={{ left: `${cur.x * 100}%`, top: `${cur.y * 100}%` }}><Icon name="check" size={16} stroke={3} /></span>
            {res.tap && !res.ok && <span className="pin bad" style={{ left: `${res.tap.x * 100}%`, top: `${res.tap.y * 100}%` }}><Icon name="close" size={16} stroke={3} /></span>}
          </>
        )}
        {showAll && null}
      </div>

      {mode === 'what' && (
        <div className="mt">
          {points.length >= 4 ? (
            <div className="opts">
              {options.map((o) => {
                const cls = res ? (o === cur.label ? ' good' : res.given === o ? ' bad' : '') : ''
                return <button key={o} className={'opt' + cls} disabled={!!res} dir="auto" onClick={() => answerWhat(o)}>{o}</button>
              })}
            </div>
          ) : (
            <form className="col" onSubmit={(e) => { e.preventDefault(); submitTyped() }}>
              <input className="input" dir="auto" autoFocus autoCapitalize="off" spellCheck={false} placeholder="מה זה?" value={input} readOnly={!!res} onChange={(e) => setInput(e.target.value)} />
              {!res && <button className="btn primary">בדוק</button>}
            </form>
          )}
        </div>
      )}

      {res && (
        <div className={'feedback ' + (res.ok ? 'good' : 'bad')}>
          {res.ok ? 'נכון' : <>לא נכון. {mode === 'what' ? <>זה: <span className="answer-line">{cur.label}</span></> : 'הנקודה הנכונה מסומנת בירוק.'}</>}
          <button className="btn primary block mt-s" autoFocus onClick={next}>המשך</button>
        </div>
      )}
    </div>
  )
}
