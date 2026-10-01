import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { exploreSets } from '../api'
import { useLoad } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import Icon from '../components/Icon'
import TopBar from '../components/TopBar'

export default function Explore() {
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const h = setTimeout(() => setTerm(q), 300)
    return () => clearTimeout(h)
  }, [q])
  const { data, error, loading } = useLoad(() => exploreSets(term), [term])

  return (
    <div className="page study">
      <TopBar back="/" title="גלה סטים ציבוריים" />
      <div className="search">
        <Icon name="search" size={20} />
        <input className="input" type="search" placeholder="חפש נושא, קורס או מילה" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt">
        {loading && !data && <Loading />}
        {error && !data && <ErrorBox msg={error.includes('listed') ? 'חסרה עמודה במסד. הרץ את supabase/migration_v3.sql ב-Supabase.' : error} />}
        {data && data.length === 0 && (
          <div className="empty">
            {term ? 'לא נמצאו סטים.' : 'עדיין אין סטים ציבוריים.'}<br />
            כדי לפרסם סט: עריכה, ואז שיתוף, ובחר "ציבורי (מופיע בחיפוש)".
          </div>
        )}
        {data && data.length > 0 && (
          <div className="list">
            {data.map((s) => (
              <Link key={s.id} to={`/s/${s.id}`} className="list-row">
                <span className="ico"><Icon name="cards" /></span>
                <span className="tx"><b>{s.title}</b><span>{s.description || `${s.card_count} כרטיסיות`}</span></span>
                <span className="badge">{s.card_count}</span>
                <span className="chev"><Icon name="chev" size={20} /></span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
