import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from './Icon'

const TABS = [
  { to: '/', icon: 'library', label: 'ספרייה', end: true },
  { to: '/review', icon: 'review', label: 'חזרה' },
  { to: '/set/new', icon: 'plus', label: 'יצירה', action: true },
  { to: '/journal', icon: 'journal', label: 'יומן' },
  { to: '/stats', icon: 'chart', label: 'התקדמות' }
]

/** סרגל ניווט צף בסגנון זכוכית, עם בועה שמחליקה בין הלשוניות */
export default function TabBar() {
  const { pathname } = useLocation()
  const active = TABS.findIndex((t) => !t.action && (t.end ? pathname === t.to : pathname.startsWith(t.to)))
  const refs = useRef<(HTMLAnchorElement | null)[]>([])
  const [box, setBox] = useState<{ x: number; w: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [bump, setBump] = useState(0)
  const prev = useRef(active)

  const measure = () => {
    const el = active >= 0 ? refs.current[active] : null
    setBox(el ? { x: el.offsetLeft, w: el.offsetWidth } : null)
  }

  useLayoutEffect(measure, [active])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // מפעיל מעברים רק אחרי הציור הראשון, כדי שהבועה לא תחליק מהפינה בכניסה
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // "מתיחה" קצרה של הבועה בכל מעבר בין לשוניות
  useEffect(() => {
    if (prev.current !== active && prev.current !== -1 && active !== -1) setBump((b) => b + 1)
    prev.current = active
  }, [active])

  return (
    <nav className="tabbar" aria-label="ניווט ראשי">
      <span
        className={'tab-glass' + (box ? ' show' : '') + (ready ? ' ready' : '')}
        style={{ transform: `translateX(${box?.x ?? 0}px)`, width: box?.w ?? 0 }}
        aria-hidden="true"
      >
        <i key={bump} className={'bubble' + (bump ? ' go' : '')} />
      </span>
      {TABS.map((t, i) => (
        <Link
          key={t.to}
          to={t.to}
          ref={(el) => { refs.current[i] = el }}
          className={i === active ? 'active' : ''}
          aria-current={i === active ? 'page' : undefined}
        >
          <Icon name={t.icon} size={24} stroke={i === active ? 2.1 : 1.8} />
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  )
}
