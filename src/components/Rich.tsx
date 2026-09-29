import { useEffect, useState, type ReactNode } from 'react'

type Katex = { renderToString: (s: string, o?: Record<string, unknown>) => string }
let mod: Katex | null = null
let loading: Promise<Katex> | null = null

function loadKatex(): Promise<Katex> {
  if (!loading) loading = import('katex').then((m) => { mod = m.default as unknown as Katex; return mod })
  return loading
}

// $x^2$ בתוך שורה, $$...$$ כבלוק. כלל "כמו פנדוק": בלי רווח אחרי הפתיחה, ובלי ספרה אחרי הסגירה (כדי לא לפרש מחירים)
const MATH = /\$\$([^$]+?)\$\$|\$(?!\s)([^$\n]*?[^\s$])\$(?!\d)/g

export default function Rich({ text }: { text: string }) {
  const has = text.includes('$')
  const [, force] = useState(0)
  useEffect(() => {
    if (has && !mod) loadKatex().then(() => force((n) => n + 1)).catch(() => {})
  }, [has])

  if (!has || !mod) return <>{text}</>

  const out: ReactNode[] = []
  let last = 0
  let i = 0
  MATH.lastIndex = 0
  for (let m = MATH.exec(text); m; m = MATH.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const display = m[1] !== undefined
    const src = (m[1] ?? m[2]).trim()
    let html = ''
    try {
      html = mod.renderToString(src, { throwOnError: false, displayMode: display })
    } catch {
      html = ''
    }
    out.push(
      html
        ? <span key={i++} className={display ? 'math-block' : 'math'} dangerouslySetInnerHTML={{ __html: html }} />
        : m[0]
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}
