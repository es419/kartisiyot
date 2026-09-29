export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0591-\u05C7\u0300-\u036f]/g, '') // ניקוד וסימני הגייה
    .replace(/[.,;:!?"'()\[\]{}<>\-_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function lev(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

export type Verdict = 'yes' | 'close' | 'no'

/** בודק תשובה מוקלדת. תשובות חלופיות מופרדות ב- / או ; */
export function grade(given: string, expected: string): Verdict {
  const g = normalize(given)
  if (!g) return 'no'
  const options = expected.split(/[\/;]/).map(normalize).filter(Boolean)
  if (options.length === 0) options.push(normalize(expected))
  const full = normalize(expected)
  if (g === full || options.includes(g)) return 'yes'
  for (const o of [full, ...options]) {
    if (o.length >= 6 && lev(g, o) <= 1) return 'close'
    if (o.length >= 12 && lev(g, o) <= 2) return 'close'
  }
  return 'no'
}

export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type ColSep = 'tab' | 'comma' | 'dash' | 'colon'
export type RowSep = 'newline' | 'semicolon'

const COL: Record<ColSep, string> = { tab: '\t', comma: ',', dash: ' - ', colon: ':' }
const ROW: Record<RowSep, string> = { newline: '\n', semicolon: ';' }

export function detectColSep(text: string): ColSep {
  if (text.includes('\t')) return 'tab'
  if (text.includes(' - ')) return 'dash'
  if (text.includes(':')) return 'colon'
  return 'comma'
}

export function parseImport(text: string, col: ColSep, row: RowSep): { term: string; definition: string }[] {
  const out: { term: string; definition: string }[] = []
  for (const line of text.split(ROW[row])) {
    const raw = line.trim()
    if (!raw) continue
    const i = raw.indexOf(COL[col])
    if (i === -1) {
      if (/\{\{.+?\}\}/.test(raw)) out.push({ term: raw, definition: '' }) // כרטיסיית השלמה
      continue
    }
    const term = raw.slice(0, i).trim()
    const definition = raw.slice(i + COL[col].length).trim()
    if (term || definition) out.push({ term, definition })
  }
  return out
}

export function exportText(cards: { term: string; definition: string }[]): string {
  return cards.map((c) => `${c.term}\t${c.definition}`).join('\n')
}

export function fmtTime(ms: number): string {
  const s = ms / 1000
  const m = Math.floor(s / 60)
  const r = (s % 60).toFixed(1).padStart(4, '0')
  return m > 0 ? `${m}:${r}` : `${(s).toFixed(1)}s`
}
