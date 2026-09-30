import { useMemo, useState } from 'react'
import { convertEntryToCard, createEntry, deleteEntry, ensureJournalSet, listEntries, listSets, updateEntry } from '../api'
import { useLoad } from '../hooks'
import { ErrorBox, Loading, Modal, useToast } from '../components/ui'
import PageHeader from '../components/PageHeader'
import type { Entry, EntryType } from '../types'

const TYPES: { id: EntryType; label: string; hint: string }[] = [
  { id: 'concept', label: 'מושג / חוק', hint: 'מה זה ומה הכלל' },
  { id: 'tool', label: 'מערכת / כלי', hint: 'איך משתמשים ולמה זה טוב' },
  { id: 'procedure', label: 'נוהל', hint: 'איך עושים X, צעד אחר צעד' },
  { id: 'contact', label: 'איש קשר', hint: 'את מי שואלים על מה' },
  { id: 'question', label: 'שאלה פתוחה', hint: 'משהו שלא הבנתי ואקח לפגישה' }
]
const typeLabel = (t: EntryType) => TYPES.find((x) => x.id === t)?.label ?? t

type Draft = { id?: string; type: EntryType; title: string; body: string; tag: string }
const empty: Draft = { type: 'concept', title: '', body: '', tag: '' }

export default function Journal() {
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [q, setQ] = useState('')
  const [typeF, setTypeF] = useState<EntryType | ''>('')
  const [tagF, setTagF] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [cardFor, setCardFor] = useState<Entry | null>(null)
  const [weekly, setWeekly] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const { data, error, loading, reload } = useLoad(async () => {
    const [entries, sets] = await Promise.all([listEntries(), listSets()])
    return { entries, sets }
  }, [])

  const tags = useMemo(() => [...new Set((data?.entries ?? []).map((e) => e.tag).filter(Boolean))].sort(), [data])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data?.entries ?? []).filter(
      (e) =>
        (!typeF || e.type === typeF) &&
        (!tagF || e.tag === tagF) &&
        (!t || (e.title + ' ' + e.body + ' ' + e.tag).toLowerCase().includes(t))
    )
  }, [data, q, typeF, tagF])

  const week = useMemo(() => {
    const since = Date.now() - 7 * 864e5
    const items = (data?.entries ?? []).filter((e) => new Date(e.created_at).getTime() >= since)
    const byType = new Map<string, number>()
    const byTag = new Map<string, number>()
    for (const e of items) {
      byType.set(e.type, (byType.get(e.type) ?? 0) + 1)
      if (e.tag) byTag.set(e.tag, (byTag.get(e.tag) ?? 0) + 1)
    }
    return { items, byType, byTag }
  }, [data])

  const openQuestions = (data?.entries ?? []).filter((e) => e.type === 'question' && !e.resolved)

  async function save() {
    if (!draft || !draft.title.trim()) return
    try {
      const payload = { type: draft.type, title: draft.title.trim(), body: draft.body.trim(), tag: draft.tag.trim() }
      if (draft.id) await updateEntry(draft.id, payload)
      else await createEntry(payload)
      setDraft(null)
      reload()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function remove(e: Entry) {
    if (!confirm('למחוק את הרשומה?')) return
    await deleteEntry(e.id).catch((x: Error) => setErr(x.message))
    reload()
  }

  async function makeCard(entry: Entry, setId: string | 'journal') {
    try {
      const id = setId === 'journal' ? (await ensureJournalSet()).id : setId
      await convertEntryToCard(entry, id)
      setCardFor(null)
      toast.show('נוספה כרטיסייה')
      reload()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function convertAll() {
    const todo = (data?.entries ?? []).filter((e) => !e.card_id && e.type !== 'question' && e.body.trim())
    if (!todo.length) return toast.show('אין רשומות להמרה')
    if (!confirm(`להפוך ${todo.length} רשומות לכרטיסיות בסט "יומן למידה"?`)) return
    try {
      const s = await ensureJournalSet()
      for (const e of todo) await convertEntryToCard(e, s.id)
      reload()
      toast.show(`נוספו ${todo.length} כרטיסיות`)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
  const hint = TYPES.find((t) => t.id === draft?.type)?.hint

  return (
    <div className="page">
      <PageHeader title="יומן למידה">
        <button className="btn primary" onClick={() => setDraft(empty)}>＋ רשומה</button>
      </PageHeader>
      {err && <div className="error mt-s">{err}</div>}

      <div className="row mt wrap">
        <button className="btn sm" onClick={() => setWeekly(true)}>סיכום שבועי</button>
        {openQuestions.length > 0 && <button className="chip on" onClick={() => setTypeF(typeF === 'question' ? '' : 'question')}>{openQuestions.length} {openQuestions.length === 1 ? 'שאלה פתוחה' : 'שאלות פתוחות'}</button>}
      </div>

      <div className="col mt">
        <input className="input" placeholder="חיפוש ביומן" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row wrap">
          <button className={'chip' + (!typeF ? ' on' : '')} onClick={() => setTypeF('')}>הכול</button>
          {TYPES.map((t) => <button key={t.id} className={'chip' + (typeF === t.id ? ' on' : '')} onClick={() => setTypeF(typeF === t.id ? '' : t.id)}>{t.label}</button>)}
        </div>
        {tags.length > 0 && (
          <div className="row wrap">
            {tags.map((t) => <button key={t} className={'chip' + (tagF === t ? ' on' : '')} onClick={() => setTagF(tagF === t ? '' : t)}>#{t}</button>)}
          </div>
        )}
      </div>

      <div className="col mt">
        {loading && !data && <Loading />}
        {error && !data && <ErrorBox msg={error} />}
        {data && data.entries.length === 0 && <div className="empty">היומן ריק.<br />רשום משהו שלמדת היום. שורה אחת מספיקה.</div>}
        {shown.map((e) => (
          <div key={e.id} className="entry" style={e.type === 'question' && !e.resolved ? { borderInlineStart: '8px solid var(--mark)' } : undefined}>
            <div className="row spread" onClick={() => setOpen(open === e.id ? null : e.id)} style={{ cursor: 'pointer' }}>
              <div className="grow">
                <b dir="auto" style={e.resolved ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{e.title}</b>
                <div className="row wrap mt-s">
                  <span className="badge">{typeLabel(e.type)}</span>
                  {e.tag && <span className="badge mark">#{e.tag}</span>}
                  {e.card_id && <span className="badge good">✓ כרטיסייה</span>}
                  <span className="muted small">{fmt(e.created_at)}</span>
                </div>
              </div>
              <span className="muted">{open === e.id ? '▴' : '▾'}</span>
            </div>
            {open === e.id && (
              <>
                {e.body && <div className="body" dir="auto">{e.body}</div>}
                <div className="row wrap mt">
                  {e.type === 'question' && <button className="btn sm" onClick={() => updateEntry(e.id, { resolved: !e.resolved }).then(reload)}>{e.resolved ? 'פתח מחדש' : '✓ נפתרה'}</button>}
                  {!e.card_id && e.body.trim() && <button className="btn sm" onClick={() => setCardFor(e)}>הפוך לכרטיסייה</button>}
                  <button className="btn sm" onClick={() => setDraft({ id: e.id, type: e.type, title: e.title, body: e.body, tag: e.tag })}>עריכה</button>
                  <button className="btn danger sm" onClick={() => remove(e)}>מחק</button>
                </div>
              </>
            )}
          </div>
        ))}
        {data && data.entries.some((e) => !e.card_id && e.type !== 'question' && e.body.trim()) && shown.length > 0 && !q && !typeF && !tagF && (
          <button className="btn ghost sm" onClick={convertAll}>הפוך את כל הרשומות לכרטיסיות</button>
        )}
      </div>

      {draft && (
        <Modal onClose={() => setDraft(null)}>
          <div className="col">
            <h2>{draft.id ? 'עריכת רשומה' : 'רשומה חדשה'}</h2>
            <div className="row wrap">
              {TYPES.map((t) => <button key={t.id} className={'chip' + (draft.type === t.id ? ' on' : '')} onClick={() => setDraft({ ...draft, type: t.id })}>{t.label}</button>)}
            </div>
            <input className="input" autoFocus dir="auto" placeholder={draft.type === 'question' ? 'מה לא הבנתי?' : draft.type === 'contact' ? 'שם ותחום' : 'כותרת'} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <textarea className="textarea" rows={5} dir="auto" placeholder={hint} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            <input className="input" list="tags" placeholder="תגית (למשל קורס או נושא)" value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value.replace(/^#/, '') })} />
            <datalist id="tags">{tags.map((t) => <option key={t} value={t} />)}</datalist>
            <p className="muted small">אל תכתוב כאן פרטי נישומים, מספרי תיק או מידע פנימי רגיש. רשום מה למדת, לא על מי.</p>
            <button className="btn primary" onClick={save} disabled={!draft.title.trim()}>שמור</button>
          </div>
        </Modal>
      )}

      {cardFor && data && (
        <Modal onClose={() => setCardFor(null)}>
          <div className="col">
            <h2>להוסיף לאיזה סט?</h2>
            <p className="muted small">הכותרת תהפוך למושג והתוכן להגדרה.</p>
            <button className="btn primary" onClick={() => makeCard(cardFor, 'journal')}>סט "יומן למידה"</button>
            {data.sets.filter((s) => s.title !== 'יומן למידה').map((s) => (
              <button key={s.id} className="btn" onClick={() => makeCard(cardFor, s.id)}>{s.title}</button>
            ))}
          </div>
        </Modal>
      )}

      {weekly && (
        <Modal onClose={() => setWeekly(false)}>
          <div className="col">
            <h2>סיכום 7 ימים</h2>
            <p><b>{week.items.length}</b> רשומות חדשות</p>
            {[...week.byType].length > 0 && (
              <div className="row wrap">{[...week.byType].map(([t, n]) => <span key={t} className="badge">{typeLabel(t as EntryType)}: {n}</span>)}</div>
            )}
            {[...week.byTag].length > 0 && (
              <div className="row wrap">{[...week.byTag].sort((a, b) => b[1] - a[1]).map(([t, n]) => <span key={t} className="badge mark">#{t}: {n}</span>)}</div>
            )}
            <h3 className="mt-s">שאלות פתוחות לפגישה</h3>
            {openQuestions.length === 0 ? <p className="muted">אין שאלות פתוחות.</p> : openQuestions.map((e) => <div key={e.id} className="entry" dir="auto">{e.title}</div>)}
          </div>
        </Modal>
      )}
      {toast.node}
    </div>
  )
}
