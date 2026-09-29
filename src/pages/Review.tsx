import { Link } from 'react-router-dom'
import { dueCards } from '../api'
import { useLoad } from '../hooks'
import { ErrorBox, Loading } from '../components/ui'
import LearnSession from '../components/LearnSession'

export default function Review() {
  const { data, error, loading } = useLoad(() => dueCards(30), [])
  if (loading && !data) return <div className="page"><Loading /></div>
  if (error && !data) return <div className="page"><ErrorBox msg={error} /></div>
  if (!data) return null
  if (data.cards.length === 0) {
    return (
      <div className="page">
        <h1>חזרה יומית</h1>
        <div className="empty mt">
          אין כרטיסיות שמחכות לחזרה עכשיו.<br />
          כרטיסיות נכנסות לכאן אחרי שלמדת אותן במצב למידה, כרטיסיות או מבחן.
          <div className="mt-s"><Link className="btn primary" to="/">לספרייה</Link></div>
        </div>
      </div>
    )
  }
  return <LearnSession cards={data.cards} progress={data.progress} mode="review" title="חזרה יומית" backTo="/" />
}
