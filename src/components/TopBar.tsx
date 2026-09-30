import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'

type Props = { title?: ReactNode; back?: string; close?: string; right?: ReactNode }

/** סרגל עליון בסגנון iOS: כפתור חזרה/סגירה בצד ההתחלה, כותרת באמצע ופעולות בצד הסוף */
export default function TopBar({ title, back, close, right }: Props) {
  const to = close ?? back
  return (
    <header className="topbar">
      <div className="slot">
        {to && (
          <Link to={to} className="icon-btn" aria-label={close ? 'סגור' : 'חזרה'}>
            <Icon name={close ? 'close' : 'back'} size={24} />
          </Link>
        )}
      </div>
      <div className="title">{title}</div>
      <div className="slot end">{right}</div>
    </header>
  )
}
