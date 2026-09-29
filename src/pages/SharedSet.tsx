import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { copySet } from '../api'
import { supabase } from '../supabase'
import { useLoad } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import { Logo } from '../components/Logo'
import Rich from '../components/Rich'
import type { Card, SetRow } from '../types'

export default function SharedSet() {
  const { id } = useParams()
  const { session } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const { data, error, loading } = useLoad(async () => {
    const s = await supabase.from('fc_sets').select('*').eq('id', id!).eq('is_public', true).single()
    if (s.error) throw new Error('הסט לא נמצא או שהוא לא משותף')
    const c = await supabase.from('fc_cards').select('*').eq('set_id', id!).order('position')
    if (c.error) throw new Error(c.error.message)
    return { set: s.data as SetRow, cards: (c.data as Card[]).filter((x) => x.term.trim() || x.definition.trim()) }
  }, [id])

  async function save() {
    setBusy(true)
    try {
      const s = await copySet(id!)
      nav(`/set/${s.id}`)
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  if (loading) return <div className="page"><Loading /></div>
  if (error || !data) return <div className="page"><ErrorBox msg={error ?? 'שגיאה'} /></div>

  return (
    <div className="page study">
      <div className="row"><Logo size={34} /><h1>{data.set.title}</h1></div>
      {data.set.description && <p className="muted mt-s">{data.set.description}</p>}
      <p className="muted small mt-s">{data.cards.length} כרטיסיות · סט משותף לקריאה בלבד</p>
      {err && <div className="error mt-s">{err}</div>}
      <div className="row mt">
        {session ? (
          <button className="btn primary" disabled={busy} onClick={save}>שמור עותק בספרייה שלי</button>
        ) : (
          <Link className="btn primary" to="/">התחבר כדי לשמור עותק</Link>
        )}
      </div>
      <div className="col mt">
        {data.cards.map((c) => (
          <div key={c.id} className="entry">
            <div className="row">
              <div className="grow">
                <b dir="auto" style={{ whiteSpace: 'pre-wrap' }}><Rich text={c.term} /></b>
                <div className="muted" dir="auto" style={{ whiteSpace: 'pre-wrap' }}><Rich text={c.definition} /></div>
              </div>
              {c.image_url && <img className="thumb" src={c.image_url} alt="" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
