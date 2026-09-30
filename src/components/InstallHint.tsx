import { useState } from 'react'
import { Logo } from './Logo'
import Icon from './Icon'

export default function InstallHint() {
  const [hide, setHide] = useState(() => localStorage.getItem('fc:hint') === '1')
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches
  if (hide || !ios || standalone) return null
  return (
    <div className="entry row mt-s">
      <Logo size={40} />
      <div className="grow small">
        <b>הוסף למסך הבית</b>
        <div className="muted">לחץ על כפתור השיתוף ב-Safari ואז "הוסף למסך הבית". ככה זה נפתח כמו אפליקציה.</div>
      </div>
      <button className="icon-btn" aria-label="סגור" onClick={() => { localStorage.setItem('fc:hint', '1'); setHide(true) }}><Icon name="close" size={20} /></button>
    </div>
  )
}
