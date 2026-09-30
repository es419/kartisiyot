import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createSet, deleteCard, deleteSet, duplicateCard, generateCards, getSet, insertCard, insertCards, listCards, listFolders,
  listSets, moveCard, reorderCards, updateCard, updateSet, uploadImage
} from '../api'
import { useLoad } from '../hooks'
import { ErrorBox, Loading, Modal, useToast } from '../components/ui'
import Rich from '../components/Rich'
import Icon from '../components/Icon'
import TopBar from '../components/TopBar'
import { LANGS } from '../lib/tts'
import { resizeImage } from '../lib/image'
import { isCloze } from '../lib/cloze'
import { detectColSep, exportText, parseImport, type ColSep, type RowSep } from '../lib/text'
import type { Card, SetRow } from '../types'

export function NewSet() {
  const nav = useNavigate()
  const [err, setErr] = useState<string | null>(null)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    createSet()
      .then((s) => nav(`/set/${s.id}/edit`, { replace: true }))
      .catch((e: Error) => setErr(e.message))
  }, [nav])
  return <div className="page">{err ? <ErrorBox msg={err} /> : <Loading />}</div>
}

type RowProps = {
  card: Card
  first: boolean
  last: boolean
  onDelete: () => void
  onUp: () => void
  onDown: () => void
  onDuplicate: () => void
  onMove: () => void
  onError: (m: string) => void
}

function CardRow({ card, first, last, onDelete, onUp, onDown, onDuplicate, onMove, onError }: RowProps) {
  const [term, setTerm] = useState(card.term)
  const [def, setDef] = useState(card.definition)
  const [img, setImg] = useState(card.image_url)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const termRef = useRef<HTMLTextAreaElement>(null)
  const cloze = isCloze(term)

  const save = (patch: Partial<Card>) => updateCard(card.id, patch).catch((e: Error) => onError(e.message))

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true)
    try {
      const url = await uploadImage(await resizeImage(f))
      setImg(url)
      await save({ image_url: url })
    } catch (e) {
      onError((e as Error).message)
    }
    setBusy(false)
  }

  function makeHole() {
    const el = termRef.current
    if (!el) return
    const a = el.selectionStart
    const b = el.selectionEnd
    if (a === b) return onError('סמן בשדה המושג את המילים שיהפכו לחור, ואז לחץ על "חור".')
    const next = term.slice(0, a) + '{{' + term.slice(a, b) + '}}' + term.slice(b)
    setTerm(next)
    save({ term: next })
  }

  return (
    <div className="card-row">
      <div className="two">
        <textarea ref={termRef} className="textarea" dir="auto" placeholder="מושג (או משפט עם חור)" value={term} rows={2} onChange={(e) => setTerm(e.target.value)} onBlur={() => term !== card.term && save({ term })} />
        <textarea className="textarea" dir="auto" placeholder={cloze ? 'לא נדרש בכרטיסיית השלמה' : 'הגדרה'} value={def} rows={2} disabled={cloze} onChange={(e) => setDef(e.target.value)} onBlur={() => def !== card.definition && save({ definition: def })} />
      </div>
      {cloze && <div className="cloze-note">כרטיסיית השלמה: החלקים שב-{'{{ }}'} יוסתרו בלימוד.</div>}
      {(term.includes('$') || def.includes('$')) && (
        <div className="preview" dir="auto"><Rich text={term} /> <span className="muted">←</span> <Rich text={def} /></div>
      )}
      <div className="tools">
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        {img && <img className="thumb" src={img} alt="" style={{ width: 40, height: 40 }} />}
        <button className="btn sm" disabled={busy} onClick={() => file.current?.click()}><Icon name="image" size={18} /> {busy ? 'מעלה…' : img ? 'החלף' : 'תמונה'}</button>
        {img && <button className="btn ghost sm" onClick={() => { setImg(null); save({ image_url: null }) }}>הסר</button>}
        <button className="btn sm" onClick={makeHole}>[ ] חור</button>
        <span className="grow" />
        <button className="icon-btn" aria-label="הזז למעלה" disabled={first} onClick={onUp}><Icon name="up" size={20} /></button>
        <button className="icon-btn" aria-label="הזז למטה" disabled={last} onClick={onDown}><Icon name="down" size={20} /></button>
        <button className="icon-btn" aria-label="שכפל" onClick={onDuplicate}><Icon name="copy" size={20} /></button>
        <button className="icon-btn" aria-label="העבר לסט אחר" onClick={onMove}><Icon name="chev" size={20} /></button>
        <button className="icon-btn" aria-label="מחק" onClick={onDelete} style={{ color: 'var(--bad)' }}><Icon name="trash" size={20} /></button>
      </div>
    </div>
  )
}

function fileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('קריאת הקובץ נכשלה'))
    r.readAsDataURL(f)
  })
}

export default function SetEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [err, setErr] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [tab, setTab] = useState<'paste' | 'ai'>('paste')
  const [text, setText] = useState('')
  const [col, setCol] = useState<ColSep>('tab')
  const [row, setRow] = useState<RowSep>('newline')
  const [moving, setMoving] = useState<Card | null>(null)
  const [aiText, setAiText] = useState('')
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [aiCount, setAiCount] = useState(15)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState<string | null>(null)

  const { data, error, loading, reload } = useLoad(async () => {
    const [set, cards, folders, sets] = await Promise.all([getSet(id!), listCards(id!), listFolders(), listSets()])
    return { set, cards, folders, sets }
  }, [id])

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  useEffect(() => {
    if (data) {
      setTitle(data.set.title)
      setDesc(data.set.description)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.set.id])

  if (loading && !data) return <div className="page"><Loading /></div>
  if (error && !data) return <div className="page"><ErrorBox msg={error} /></div>
  if (!data) return null
  const { set, cards, folders, sets } = data

  const patchSet = (p: Partial<SetRow>) => updateSet(set.id, p).then(reload).catch((e: Error) => setErr(e.message))
  const fail = (e: unknown) => setErr((e as Error).message)

  async function addCard() {
    const pos = (cards[cards.length - 1]?.position ?? -1) + 1
    await insertCard(set.id, pos).catch(fail)
    reload()
  }
  async function removeCard(c: Card) {
    await deleteCard(c.id).catch(fail)
    reload()
  }
  async function swap(i: number, d: number) {
    const ids = cards.map((c) => c.id)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    await reorderCards(ids).catch(fail)
    reload()
  }
  async function dup(i: number) {
    try {
      const copy = await duplicateCard(cards[i])
      const ids = cards.map((c) => c.id)
      ids.splice(i + 1, 0, copy.id)
      await reorderCards(ids)
      reload()
    } catch (e) { fail(e) }
  }
  async function doMove(toSet: string) {
    if (!moving) return
    await moveCard(moving.id, toSet).catch(fail)
    setMoving(null)
    toast.show('הכרטיסייה הועברה')
    reload()
  }

  const parsed = parseImport(text, col, row)

  async function doImport() {
    if (!parsed.length) return
    await insertCards(set.id, parsed).catch(fail)
    setText('')
    setImportOpen(false)
    toast.show(`יובאו ${parsed.length} כרטיסיות`)
    reload()
  }

  async function runAi() {
    setAiBusy(true)
    setAiErr(null)
    try {
      let out: { term: string; definition: string }[]
      if (aiFile && aiFile.type === 'application/pdf') {
        if (aiFile.size > 4 * 1024 * 1024) throw new Error('קובץ ה-PDF גדול מדי (מעל 4MB).')
        out = await generateCards({ pdf_base64: await fileToBase64(aiFile), count: aiCount })
      } else {
        const t = aiFile ? await aiFile.text() : aiText
        if (t.trim().length < 30) throw new Error('הדבק טקסט ארוך יותר או בחר קובץ.')
        out = await generateCards({ text: t, count: aiCount })
      }
      if (!out.length) throw new Error('לא נוצרו כרטיסיות. נסה חומר אחר.')
      setText(exportText(out))
      setCol('tab')
      setRow('newline')
      setTab('paste')
    } catch (e) {
      setAiErr((e as Error).message)
    }
    setAiBusy(false)
  }

  async function removeSet() {
    if (!confirm('למחוק את הסט לצמיתות, כולל כל הכרטיסיות וההתקדמות?')) return
    await deleteSet(set.id)
    nav('/', { replace: true })
  }

  return (
    <div className="page study">
      <TopBar
        back={`/set/${set.id}`}
        title="עריכת סט"
        right={
          <>
            <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(exportText(cards)); toast.show('הסט הועתק כטקסט') }}>ייצוא</button>
            <button className="btn ghost sm" onClick={() => setImportOpen(true)}>ייבוא</button>
          </>
        }
      />
      {err && <div className="error mt-s">{err}</div>}

      <div className="col mt">
        <input className="input" style={{ fontFamily: 'var(--display)', fontSize: 20 }} placeholder="כותרת הסט" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== set.title && patchSet({ title: title.trim() || 'סט חדש' })} />
        <input className="input" placeholder="תיאור (לא חובה)" value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== set.description && patchSet({ description: desc })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="field">תיקייה
            <select className="select" value={set.folder_id ?? ''} onChange={(e) => patchSet({ folder_id: e.target.value || null })}>
              <option value="">ללא</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="field">שיתוף
            <select className="select" value={set.is_public ? '1' : '0'} onChange={(e) => patchSet({ is_public: e.target.value === '1' })}>
              <option value="0">פרטי</option>
              <option value="1">כל מי שיש לו הקישור</option>
            </select>
          </label>
          <label className="field">שפת המושג (להשמעה)
            <select className="select" value={set.term_lang} onChange={(e) => patchSet({ term_lang: e.target.value })}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <label className="field">שפת ההגדרה
            <select className="select" value={set.def_lang} onChange={(e) => patchSet({ def_lang: e.target.value })}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>תאריך מבחן (לתכנון הלימוד)
            <input className="input" type="date" value={set.exam_date ?? ''} onChange={(e) => { const v = e.target.value || null; if (v !== (set.exam_date ?? null)) patchSet({ exam_date: v }) }} />
          </label>
        </div>
        <p className="muted small">נוסחאות: כתוב <bdi><code dir="ltr" className="code-ltr">$x^2 + y^2$</code></bdi> בתוך שורה. כרטיסיית השלמה: סמן מילים בשדה המושג ולחץ "חור".</p>
      </div>

      <h2 className="mt">כרטיסיות ({cards.length})</h2>
      <div className="col mt-s">
        {cards.map((c, i) => (
          <CardRow
            key={c.id}
            card={c}
            first={i === 0}
            last={i === cards.length - 1}
            onDelete={() => removeCard(c)}
            onUp={() => swap(i, -1)}
            onDown={() => swap(i, 1)}
            onDuplicate={() => dup(i)}
            onMove={() => setMoving(c)}
            onError={setErr}
          />
        ))}
        <button className="btn block" onClick={addCard}>＋ כרטיסייה</button>
      </div>

      <Link to={`/set/${set.id}`} className="btn primary block mt">סיום</Link>
      <button className="btn danger block mt-s" onClick={removeSet}>מחק סט</button>

      {importOpen && (
        <Modal onClose={() => setImportOpen(false)}>
          <div className="col">
            <div className="tabs">
              <button className={'chip' + (tab === 'paste' ? ' on' : '')} onClick={() => setTab('paste')}>הדבקה</button>
              <button className={'chip' + (tab === 'ai' ? ' on' : '')} onClick={() => setTab('ai')}>✨ יצירה עם AI</button>
            </div>

            {tab === 'paste' ? (
              <>
                <p className="muted small">הדבק רשימה, למשל העתקה מאקסל (עמודה ראשונה מושג, שנייה הגדרה). שורה עם {'{{ }}'} ללא הגדרה תיהפך לכרטיסיית השלמה.</p>
                <textarea className="textarea" rows={7} dir="auto" placeholder={'מושג ← טאב → הגדרה'} value={text} onChange={(e) => { setText(e.target.value); setCol(detectColSep(e.target.value)) }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field">בין מושג להגדרה
                    <select className="select" value={col} onChange={(e) => setCol(e.target.value as ColSep)}>
                      <option value="tab">טאב</option>
                      <option value="comma">פסיק</option>
                      <option value="dash">מקף עם רווחים</option>
                      <option value="colon">נקודתיים</option>
                    </select>
                  </label>
                  <label className="field">בין כרטיסיות
                    <select className="select" value={row} onChange={(e) => setRow(e.target.value as RowSep)}>
                      <option value="newline">שורה חדשה</option>
                      <option value="semicolon">נקודה-פסיק</option>
                    </select>
                  </label>
                </div>
                <p className="small">{parsed.length ? `זוהו ${parsed.length} כרטיסיות` : 'לא זוהו כרטיסיות עדיין'}</p>
                <button className="btn primary" disabled={!parsed.length} onClick={doImport}>ייבא {parsed.length || ''}</button>
              </>
            ) : (
              <>
                <p className="muted small">הדבק סיכום, או בחר קובץ טקסט/PDF, וה-AI יציע כרטיסיות. תוכל לערוך אותן לפני הייבוא. הטקסט נשלח ל-Anthropic דרך פונקציית שרת שלך. אל תדביק חומר פנימי או רגיש מהעבודה.</p>
                <textarea className="textarea" rows={6} dir="auto" placeholder="הדבק כאן חומר ללימוד" value={aiText} disabled={!!aiFile} onChange={(e) => setAiText(e.target.value)} />
                <div className="row wrap">
                  <input type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" onChange={(e) => setAiFile(e.target.files?.[0] ?? null)} />
                  {aiFile && <button className="btn ghost sm" onClick={() => setAiFile(null)}>הסר קובץ</button>}
                </div>
                <label className="field">מספר כרטיסיות
                  <select className="select" value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
                    {[10, 15, 25, 40].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                {aiErr && <div className="error">{aiErr}</div>}
                <button className="btn primary" disabled={aiBusy} onClick={runAi}>{aiBusy ? 'יוצר…' : 'צור כרטיסיות'}</button>
              </>
            )}
          </div>
        </Modal>
      )}

      {moving && (
        <Modal onClose={() => setMoving(null)}>
          <div className="col">
            <h2>להעביר לאיזה סט?</h2>
            {sets.filter((s) => s.id !== set.id).length === 0 && <p className="muted">אין סטים אחרים.</p>}
            {sets.filter((s) => s.id !== set.id).map((s) => (
              <button key={s.id} className="btn" onClick={() => doMove(s.id)}>{s.title}</button>
            ))}
          </div>
        </Modal>
      )}
      {toast.node}
    </div>
  )
}
