import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useStudy } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import LearnSession from '../components/LearnSession'

export default function Learn({ mode }: { mode: 'learn' | 'write' }) {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const { data, error, loading } = useStudy(id!, sp.get('starred') === '1')
  if (loading && !data) return <div className="page"><Loading /></div>
  if (error && !data) return <div className="page"><ErrorBox msg={error} /></div>
  if (!data) return null
  if (data.cards.length === 0) return <div className="page"><div className="empty">אין כרטיסיות ללימוד.</div><Link className="btn mt" to={`/set/${id}`}>חזרה</Link></div>
  return (
    <LearnSession
      key={mode}
      cards={data.cards}
      progress={data.progress}
      mode={mode}
      title={mode === 'learn' ? 'למידה' : 'כתיבה'}
      backTo={`/set/${id}`}
      termLang={data.set.term_lang}
      defLang={data.set.def_lang}
    />
  )
}
