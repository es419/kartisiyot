import { useRef, useState } from 'react'
import { aiSolve, type Solution } from '../ai'
import AiNote, { aiErrorText } from '../components/AiNote'
import Icon from '../components/Icon'
import Md from '../components/Md'
import Rich from '../components/Rich'
import TopBar from '../components/TopBar'
import { resizeImage } from '../lib/image'

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('קריאת התמונה נכשלה'))
    r.readAsDataURL(b)
  })
}

export default function Solve() {
  const [text, setText] = useState('')
  const [img, setImg] = useState<{ b64: string; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sol, setSol] = useState<Solution | null>(null)
  const file = useRef<HTMLInputElement>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    try {
      const blob = await resizeImage(f, 1400)
      setImg({ b64: await blobToBase64(blob), url: URL.createObjectURL(blob) })
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function solve() {
    setErr(null)
    if (!img && text.trim().length < 3) return setErr('כתוב שאלה או צלם אותה.')
    setBusy(true)
    setSol(null)
    try {
      const s = await aiSolve({ text: text.trim() || undefined, image_base64: img?.b64 })
      if (!s.steps.length) throw new Error('לא התקבל פתרון. נסה לנסח מחדש.')
      setSol(s)
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
        </div>
      )}
      <AiNote text="זה פתרון שנוצר על ידי AI, לא פתרון רשמי מספר לימוד, והוא עלול לטעות. בדוק אותו לפני שאתה סומך עליו. אל תעלה חומר פנימי או רגיש מהעבודה." />
    </div>
  )
}
