import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { computeStreak, countDue, createFolder, deleteFolder, getActivity, listFolders, listSets, renameFolder, searchCards, type CardHit } from '../api'
import { useLoad } from '../hooks'
import { ErrorBox, Loading, Modal } from '../components/ui'
import PageHeader from '../components/PageHeader'
import InstallHint from '../components/InstallHint'
import Rich from '../components/Rich'
import { getGoal } from '../lib/goal'
import { todayStr } from '../lib/text'
import { supabase } from '../supabase'
import type { SetRow } from '../types'

function daysUntil(date: string): number {
  return Math.ceil((new Date(date + 'T00:00:00').getTime() - Date.now()) / 864e5)
}

export default function Library() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<CardHit[]>([])
  const [folderModal, setFolderModal] = useState<null | { id?: string; name: string }>(null)
  const [due, setDue] = useState(0)
  const [streak, setStreak] = useState(0)
  const [today, setToday] = useState(0)
  const goal = getGoal()

  const { data, error, loading, reload } = useLoad(async () => {
    const [sets, folders] = await Promise.all([listSets(), listFolders()])
    return { sets, folders }
  }, [])

  useEffect(() => {
    countDue().then(setDue).catch(() => {})
    getActivity(60)
      .then((a) => {
        setStreak(computeStreak(a))
        setToday(a.find((r) => r.day === todayStr())?.cards ?? 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) { setHits([]); return }
    const h = setTimeout(() => searchCards(t).then(setHits).catch(() => setHits([])), 300)
    return () => clearTimeout(h)
  }, [q])

  const filtered = useMemo(() => {
    const s = data?.sets ?? []
    const t = q.trim().toLowerCase()
    return t ? s.filter((x) => (x.title + ' ' + x.description).toLowerCase().includes(t)) : s
  }, [data, q])

  const byFolder = useMemo(() => {
    const m = new Map<string | null, SetRow[]>()
    for (const s of filtered) m.set(s.folder_id, [...(m.get(s.folder_id) ?? []), s])
    return m
  }, [filtered])

  async function saveFolder() {
    if (!folderModal || !folderModal.name.trim()) return
    if (folderModal.id) await renameFolder(folderModal.id, folderModal.name.trim())
    else await createFolder(folderModal.name.trim())
    setFolderModal(null)
    reload()
  }

  async function removeFolder(id: string) {
    if (!confirm('למחוק את התיקייה? הסטים שבתוכה יישארו בספרייה.')) return
    await deleteFolder(id)
    setFolderModal(null)
    reload()
  }

  const tile = (s: SetRow) => {
    const left = s.exam_date ? daysUntil(s.exam_date) : null
    return (
      <Link key={s.id} to={`/set/${s.id}`} className="set-tile">
        <h3>{s.title}</h3>
        <div className="row wrap muted small">
          <span>{s.card_count ?? 0} כרטיסיות</span>
          {s.is_public && <span className="badge good">משותף</span>}
          {left !== null && left >= 0 && <span className="badge mark">{left === 0 ? 'מבחן היום' : `מבחן בעוד ${left} ימים`}</span>}
        </div>
      </Link>
    )
  }

  const pct = Math.min(100, Math.round((today / goal) * 100))

  return (
    <div className="page">
      <PageHeader title="הספרייה">
        <button className="btn ghost sm" onClick={() => supabase.auth.signOut()}>התנתק</button>
      </PageHeader>
      <InstallHint />

      <div className="stat-strip mt-s">
        <div className="stat"><b>{streak}</b><span>ימים ברצף</span></div>
        <Link to="/review" className="stat" style={{ textDecoration: 'none', color: 'inherit' }}>
          <b>{due}</b><span>לחזרה היום</span>
        </Link>
      </div>
      <div className={'goal' + (today >= goal ? ' done' : '')}>
        <div className="row spread small muted"><span>יעד יומי</span><span>{today} / {goal}</span></div>
        <div className="progress mt-s"><i style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="row mt">
        <input className="input" type="search" placeholder="חיפוש סטים וכרטיסיות" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" onClick={() => nav('/set/new')}>＋ סט</button>
        <button className="btn" aria-label="תיקייה חדשה" onClick={() => setFolderModal({ name: '' })}>📁</button>
      </div>

      {hits.length > 0 && (
        <div className="col mt">
          <h2>כרטיסיות שנמצאו</h2>
          {hits.map((h) => (
            <Link key={h.id} to={`/set/${h.set_id}`} className="entry" style={{ textDecoration: 'none', color: 'inherit' }}>
              <b dir="auto"><Rich text={h.term} /></b>
              <div className="muted" dir="auto"><Rich text={h.definition} /></div>
              <span className="badge mt-s">{h.set_title}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="col mt">
        {loading && !data && <Loading />}
        {error && !data && <ErrorBox msg={error} />}
        {data && data.sets.length === 0 && (
          <div className="empty">
            עדיין אין סטים.<br />צור סט ראשון, או ייבא רשימה מאקסל בתוך הסט.
          </div>
        )}

        {data?.folders.map((f) => {
          const items = byFolder.get(f.id) ?? []
          if (q && items.length === 0) return null
          return (
            <section key={f.id} className="col">
              <div className="row spread">
                <h2>📁 {f.name}</h2>
                <button className="btn ghost sm" onClick={() => setFolderModal({ id: f.id, name: f.name })}>עריכה</button>
              </div>
              {items.length ? <div className="grid">{items.map(tile)}</div> : <p className="muted small">התיקייה ריקה. בחר תיקייה בעריכת סט כדי להוסיף אליה.</p>}
            </section>
          )
        })}

        {(byFolder.get(null)?.length ?? 0) > 0 && (
          <section className="col">
            {(data?.folders.length ?? 0) > 0 && <h2>ללא תיקייה</h2>}
            <div className="grid">{byFolder.get(null)!.map(tile)}</div>
          </section>
        )}
      </div>

      {folderModal && (
        <Modal onClose={() => setFolderModal(null)}>
          <div className="col">
            <h2>{folderModal.id ? 'עריכת תיקייה' : 'תיקייה חדשה'}</h2>
            <input className="input" autoFocus placeholder="שם התיקייה" value={folderModal.name} onChange={(e) => setFolderModal({ ...folderModal, name: e.target.value })} />
            <div className="row">
              <button className="btn primary grow" onClick={saveFolder}>שמור</button>
              {folderModal.id && <button className="btn danger" onClick={() => removeFolder(folderModal.id!)}>מחק</button>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
