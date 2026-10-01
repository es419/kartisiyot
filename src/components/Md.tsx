import type { ReactNode } from 'react'
import Rich from './Rich'

function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}><Rich text={part} /></b> : <Rich key={i} text={part} />))
}

/** מציג טקסט עם כותרות (#), רשימות (-), הדגשות (**) ונוסחאות ($) */
export default function Md({ text }: { text: string }) {
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      out.push(<ul key={'u' + out.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>)
      list = []
    }
  }
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) { flush(); continue }
    const h = t.match(/^#{1,3}\s+(.*)/)
    const li = t.match(/^[-*•]\s+(.*)/)
    if (h) { flush(); out.push(<h3 key={'h' + out.length}>{inline(h[1])}</h3>) }
    else if (li) list.push(li[1])
    else { flush(); out.push(<p key={'p' + out.length}>{inline(t)}</p>) }
  }
  flush()
  return <div className="md" dir="auto">{out}</div>
}
