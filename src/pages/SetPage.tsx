import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProgress, getSet, listCards, updateCard } from '../api'
import { useLoad } from '../hooks'
import { ErrorBox, Loading, useToast } from '../components/ui'
import Rich from '../components/Rich'
import Icon from '../components/Icon'
import TopBar from '../components/TopBar'
import { clozeView, studyView } from '../lib/cloze'
import { speak } from '../lib/tts'
import type { Card, Progress } from '../types'

function PreviewCard({ c }: { c: Card }) {
  const [back, setBack] = useState(false)
  return (
    <div className="pcard" dir="auto" role="button" aria-label="הפוך כרטיסייה" onClick={() => setBack(!back)}>
      <span className="tag">{back ? 'הגדרה' : 'מושג'}</span>
      {!back && c.image_url && <img src={c.image_url} alt="" />}
      <div><Rich text={back ? c.definition : c.term} /></div>
    </div>
  )
}

export default function SetPage() {
  const { id } = useParams()
  const [starredOnly, setStarredOnly] = useState(false)
  const toast = useToast()
  const { data, error, loading, setData } = useLoad(async () => {
    const [set, cards, progress] = await Promise.all([
      getSet(id!),
      listCards(id!),
      getProgress(id!).catch(() => ({} as Record<string, Progress>))
    ])
    return { set, cards, progress }
  }, [id])

  if (loading && !data) return <div className="page"><TopBar back="/" /><Loading /></div>
  if (error && !data) return <div className="page"><TopBar back="/" /><ErrorBox msg={error} /></div>
  if (!data) return null

  const { set, progress } = data
  const valid = studyView(data.cards)
  const starredCount = valid.filter((c) => c.starred).length
  const q = starredOnly ? '?starred=1' : ''

  const now = Date.now()
  const unseen = valid.filter((c) => !progress[c.id]).length
  const dueNow = valid.filter((c) => progress[c.id] && new Date(progress[c.id].due_at).getTime() <= now).length
  const solid = valid.filter((c) => (progress[c.id]?.box ?? 0) >= 3).length
  const left = set.exam_date ? Math.ceil((new Date(set.exam_date + 'T00:00:00').getTime() - now) / 864e5) : null

  async function toggleStar(c: Card) {
    setData({ ...data!, cards: data!.cards.map((x) => (x.id === c.id ? { ...x, starred: !x.starred } : x)) })
    await updateCard(c.id, { starred: !c.starred }).catch(() => {})
  }

  const shareUrl = `${location.origin}${location.pathname}#/s/${set.id}`

  const modes = [
    { to: 'flashcards', icon: 'cards', t: 'כרטיסיות', d: 'דפדוף והיפוך', min: 1 },
    { to: 'learn', icon: 'learn', t: 'למידה', d: 'חזרה מרווחת חכמה', min: 1 },
    { to: 'write', icon: 'write', t: 'כתיבה', d: 'הקלדת התשובות', min: 1 },
    { to: 'test', icon: 'test', t: 'מבחן', d: 'נוצר אוטומטית מהסט', min: 1 },
    { to: 'match', icon: 'match', t: 'התאמה', d: 'מול השעון', min: 2 },
    { to: 'gravity', icon: 'gravity', t: 'כבידה', d: 'הקלד לפני שיפול', min: 3 },
    { to: 'listen', icon: 'listen', t: 'האזנה', d: 'הקראה רציפה', min: 1 }
  ]
  const n = starredOnly ? starredCount : valid.length

  return (
    <div className="page study">
      <TopBar
        back="/"
        right={<Link to={`/set/${set.id}/edit`} className="icon-btn" aria-label="עריכה"><Icon name="edit" /></Link>}
      />

      <h1>{set.title}</h1>
      {set.description && <p className="muted mt-s">{set.description}</p>}
      <div className="row wrap mt-s">
        <span className="badge">{valid.length} כרטיסיות</span>
        {valid.length > 0 && <span className="badge good">{solid} מוכרות היטב</span>}
        {set.is_public && <span className="badge primary">משותף</span>}
        {left !== null && left >= 0 && <span className="badge mark">{left === 0 ? 'מבחן היום' : `מבחן בעוד ${left} ימים`}</span>}
      </div>

      {valid.length > 0 && (
        <div className="carousel mt">
          {valid.slice(0, 30).map((c) => <PreviewCard key={c.id} c={c} />)}
        </div>
      )}

      {left !== null && (
        <div className="entry plan">
          {left > 0 ? (
            <>
              <b>המבחן בעוד {left} {left === 1 ? 'יום' : 'ימים'}</b>
              <div className="small mt-s">
                {unseen > 0 ? <>כדאי ללמוד היום <b>{Math.ceil(unseen / left)}</b> כרטיסיות חדשות (נשארו {unseen} שלא נגעת בהן). </> : <>כל הכרטיסיות כבר נלמדו לפחות פעם אחת. </>}
                {dueNow > 0 && <>יש <b>{dueNow}</b> לחזרה עכשיו.</>}
              </div>
            </>
          ) : left === 0 ? (
            <b>המבחן היום. {dueNow > 0 ? `נשארו ${dueNow} כרטיסיות לחזרה אחרונה.` : 'אין כרטיסיות שמחכות לחזרה.'}</b>
          ) : (
            <span className="muted">תאריך המבחן עבר. אפשר לעדכן אותו בעריכה.</span>
          )}
        </div>
      )}

      {valid.length === 0 ? (
        <div className="empty mt">
          הסט ריק.<br />
          <Link to={`/set/${set.id}/edit`} className="btn primary mt-s">הוסף כרטיסיות</Link>
        </div>
      ) : (
        <>
          <div className="row mt wrap">
            <h2 className="grow">למידה</h2>
            <button className={'chip' + (!starredOnly ? ' on' : '')} onClick={() => setStarredOnly(false)}>הכול</button>
            <button className={'chip' + (starredOnly ? ' on' : '')} onClick={() => setStarredOnly(true)} disabled={starredCount === 0}>★ מסומנות ({starredCount})</button>
          </div>
          <div className="list mt-s">
            {modes.map((m) => {
              const ok = n >= m.min
              return (
                <a key={m.to} className={'list-row' + (ok ? '' : ' disabled')} href={ok ? `#/set/${set.id}/${m.to}${q}` : undefined}>
                  <span className="ico"><Icon name={m.icon} /></span>
                  <span className="tx"><b>{m.t}</b><span>{ok ? m.d : `דורש ${m.min}+ כרטיסיות`}</span></span>
                  <span className="chev"><Icon name="chev" size={20} /></span>
                </a>
              )
            })}
          </div>
        </>
      )}

      {set.is_public && (
        <div className="row mt">
          <input className="input" readOnly value={shareUrl} dir="ltr" onFocus={(e) => e.target.select()} />
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(shareUrl); toast.show('הקישור הועתק') }}>העתק</button>
        </div>
      )}

      <h2 className="mt">כרטיסיות בסט ({data.cards.length})</h2>
      <div className="list mt-s">
        {data.cards.map((raw) => {
          const c = clozeView(raw)
          return (
            <div key={c.id} className="list-row term">
              <div className="tx">
                <b dir="auto"><Rich text={c.term || '—'} /></b>
                <span className="muted" dir="auto"><Rich text={c.definition || '—'} /></span>
              </div>
              {c.image_url && <img className="thumb" src={c.image_url} alt="" style={{ width: 48, height: 48 }} />}
              <button className="icon-btn" aria-label="השמע" onClick={() => speak(c.full ?? c.term, set.term_lang)}><Icon name="speaker" size={20} /></button>
              <button className={'icon-btn' + (c.starred ? ' on' : '')} aria-label="סמן בכוכב" onClick={() => toggleStar(raw)}><Icon name="star" size={22} fill={c.starred} /></button>
            </div>
          )
        })}
      </div>
      {toast.node}
    </div>
  )
}
