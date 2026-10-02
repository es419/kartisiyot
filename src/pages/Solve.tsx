import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { aiSolve, type Solution } from '../ai'
import { addCardToSet, createSet, listSets, uploadImage } from '../api'
import AiNote, { aiErrorText } from '../components/AiNote'
import Icon from '../components/Icon'
import Md from '../components/Md'
import Rich from '../components/Rich'
import TopBar from '../components/TopBar'
import { Modal } from '../components/ui'
import { resizeImage } from '../lib/image'
import type { SetRow } from '../types'

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('קריאת התמונה נכשלה'))
    r.readAsDataURL(b)
  })
}

type Img = { b64: string; url: string; blob: Blob }

/** הפתרון כטקסט לכרטיסייה: שלבים ממוספרים ובסוף התשובה */
export function formatSolution(sol: Solution): string {
  const steps = sol.steps.map((s, i) => `${i + 1}. ${s.title ? s.title + ': ' : ''}${s.body}`).join('\n')
  return sol.answer ? `${steps}\nתשובה: ${sol.answer}` : steps
}

export default function Solve() {
  const [text, setText] = useState('')
  const [img, setImg] = useState<Img | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sol, setSol] = useState<Solution | null>(null)
  const [asked, setAsked] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null)
  const file = useRef<HTMLInputElement>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    try {
      const blob = await resizeImage(f, 1400)
      setImg({ b64: await blobToBase64(blob), url: URL.createObjectURL(blob), blob })
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function solve() {
    setErr(null)
    if (!img && text.trim().length < 3) return setErr('כתוב שאלה או צלם אותה.')
    setBusy(true)
    setSol(null)
    setSaved(null)
    try {
      const s = await aiSolve({ text: text.trim() || undefined, image_base64: img?.b64 })
      if (!s.steps.length) throw new Error('לא התקבל פתרון. נסה לנסח מחדש.')
      setSol(s)
      setAsked(text.trim())
    } catch (e) {
      setErr(aiErrorText((e as Error).message))
    }
    setBusy(false)
  }

  return (
    <div className="page study">
      <TopBar back="/" title="פותר שאלות AI" />
      <p className="muted">כתוב שאלה או צלם תרגיל, ותקבל פתרון מוסבר שלב אחר שלב.</p>
      <textarea className="textarea mt" rows={5} dir="auto" placeholder="הקלד את השאלה. אפשר גם בלי טקסט ולצרף תמונה." value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row mt-s">
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button className="btn sm" onClick={() => file.current?.click()}><Icon name="image" size={18} /> {img ? 'החלף תמונה' : 'צרף תמונה'}</button>
        {img && <button className="btn ghost sm" onClick={() => setImg(null)}>הסר</button>}
      </div>
      {img && <img src={img.url} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, marginTop: 10 }} />}
      {err && <div className="error mt">{err}</div>}
      <button className="btn primary block mt" disabled={busy} onClick={solve}>{busy ? 'פותר…' : 'פתור'}</button>

      {sol && (
        <div className="col mt">
          {sol.steps.map((s, i) => (
            <div key={i} className="entry">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="step-n">{i + 1}</span>
                <div className="grow">
                  {s.title && <b dir="auto"><Rich text={s.title} /></b>}
                  <Md text={s.body} />
                </div>
              </div>
            </div>
          ))}
          {sol.answer && (
            <div className="feedback good">
              <b>תשובה:</b> <span dir="auto"><Rich text={sol.answer} /></span>
            </div>
          )}
          {saved ? (
            <div className="feedback good">נשמר בסט "{saved.title}". <Link to={`/set/${saved.id}`}>פתח את הסט</Link></div>
          ) : (
            <button className="btn" onClick={() => setSaving(true)}>שמור בסט</button>
          )}
        </div>
      )}
      <AiNote text="זה פתרון שנוצר על ידי AI, לא פתרון רשמי מספר לימוד, והוא עלול לטעות. בדוק אותו לפני שאתה סומך עליו. אל תעלה חומר פנימי או רגיש מהעבודה." />

      {saving && sol && (
        <SaveModal
          sol={sol}
          question={asked}
          image={img}
          onClose={() => setSaving(false)}
          onDone={(id, title) => { setSaved({ id, title }); setSaving(false) }}
        />
      )}
    </div>
  )
}

function SaveModal({ sol, question, image, onClose, onDone }: { sol: Solution; question: string; image: Img | null; onClose: () => void; onDone: (id: string, title: string) => void }) {
  const [sets, setSets] = useState<SetRow[] | null>(null)
  const [target, setTarget] = useState('new')
  const [newName, setNewName] = useState('פתרונות')
  const [term, setTerm] = useState(question || 'שאלה מתמונה')
  const [def, setDef] = useState(formatSolution(sol))
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    listSets()
      .then((s) => {
        setSets(s)
        const last = localStorage.getItem('fc:solve-set')
        if (last && s.some((x) => x.id === last)) setTarget(last)
      })
      .catch(() => setSets([]))
  }, [])

  async function save() {
    if (!term.trim() || !def.trim()) return setErr('המושג וההגדרה לא יכולים להיות ריקים.')
    setBusy(true)
    setErr(null)
    try {
      let setId = target
      let title = sets?.find((s) => s.id === target)?.title ?? ''
      if (target === 'new') {
        title = newName.trim() || 'פתרונות'
        setId = (await createSet(title)).id
      }
      let image_url: string | null = null
      if (image) {
        try { image_url = await uploadImage(image.blob) } catch { /* שומרים בלי תמונה */ }
      }
      await addCardToSet(setId, { term: term.trim(), definition: def.trim(), image_url })
      try { localStorage.setItem('fc:solve-set', setId) } catch { /* ignore */ }
      onDone(setId, title)
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="col">
        <h2>שמירה כרטיסייה בסט</h2>
        <p className="muted small">המושג הוא השאלה וההגדרה היא הפתרון. אפשר לערוך את שניהם לפני השמירה.</p>

        <label className="field">לאיזה סט?
          <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="new">＋ סט חדש</option>
            {(sets ?? []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
        {target === 'new' && <input className="input" dir="auto" placeholder="שם הסט החדש" value={newName} onChange={(e) => setNewName(e.target.value)} />}

        <label className="field">מושג (השאלה)
          <textarea className="textarea" dir="auto" rows={3} value={term} onChange={(e) => setTerm(e.target.value)} />
        </label>
        <label className="field">הגדרה (הפתרון)
          <textarea className="textarea" dir="auto" rows={8} value={def} onChange={(e) => setDef(e.target.value)} />
        </label>
        <div>
          <span className="muted small">תצוגה מקדימה (כך זה ייראה בכרטיסייה):</span>
          <div className="preview mt-s" style={{ whiteSpace: 'pre-wrap' }} dir="auto"><Rich text={def} /></div>
        </div>
        {image && <p className="muted small">התמונה שצירפת תישמר יחד עם הכרטיסייה.</p>}

        <label className="row" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2 }} />
          <span className="small">בדקתי את הפתרון ואני מאשר אותו. פתרון AI עלול לטעות.</span>
        </label>

        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={!ok || busy} onClick={save}>{busy ? 'שומר…' : 'שמור'}</button>
      </div>
    </Modal>
  )
}
