import { grade, lev, normalize, type Verdict } from './text'
import type { Level } from '../types'

// מילים שלא נושאות משמעות בבדיקה הגמישה
const STOP = new Set([
  'את', 'של', 'על', 'עם', 'או', 'גם', 'זה', 'זו', 'זאת', 'הוא', 'היא', 'הם', 'הן', 'כי', 'אם', 'אל', 'מן', 'עד', 'כל', 'אחוז',
  'the', 'a', 'an', 'of', 'to', 'is', 'are', 'was', 'were', 'and', 'or', 'in', 'on', 'for', 'by', 'that', 'this', 'it', 'as', 'at', 'be', 'percent'
])
const PREFIX = 'והבלמשכ'
const isHeb = (t: string) => /[\u0590-\u05FF]/.test(t)

/** גזע גס: מסיר אותיות שימוש בתחילת מילה בעברית, סיומות ריבוי, וסיומות נפוצות באנגלית */
function stem(t: string): string {
  let s = t
  if (isHeb(s)) {
    for (let i = 0; i < 4 && s.length > 3 && PREFIX.includes(s[0]) || (i < 4 && s.length > 3 && s[0] === 'ה'); i++) s = s.slice(1)
    for (const suf of ['ים', 'ות']) {
      if (s.length - suf.length >= 3 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break }
    }
  } else if (s.length > 4) {
    for (const suf of ['ing', 'ed', 'es', 's']) {
      if (s.length - suf.length >= 3 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break }
    }
  }
  return s
}

const pct = (s: string) => s.replace(/%/g, ' אחוז ')

function tokens(text: string): string[] {
  const all = normalize(pct(text)).split(' ').filter(Boolean)
  const content = all.filter((t) => !STOP.has(t))
  return (content.length ? content : all).map(stem).filter(Boolean)
}

function same(a: string, b: string): boolean {
  if (a === b) return true
  if (/\d/.test(a) || /\d/.test(b)) return false // מספרים חייבים להיות זהים
  const m = Math.min(a.length, b.length)
  if (m < 4) return false
  return lev(a, b) <= (m >= 8 ? 2 : 1)
}

/** בדיקה גמישה מול ניסוח אחד: סדר מילים לא משנה, מתעלמים ממילות קישור ואותיות שימוש, ומקבלים טעויות הקלדה קטנות */
export function flex(given: string, expected: string): Verdict {
  const g = tokens(given)
  const e = tokens(expected)
  if (!normalize(pct(given))) return 'no'
  if (normalize(pct(given)) === normalize(pct(expected))) return 'yes'
  if (!e.length || !g.length) return 'no'

  const used = new Set<number>()
  let hit = 0
  for (const et of e) {
    const i = g.findIndex((gt, k) => !used.has(k) && same(et, gt))
    if (i >= 0) { used.add(i); hit++ }
  }
  const recall = hit / e.length
  const precision = hit / g.length

  let v: Verdict
  if (e.length <= 2) v = recall === 1 ? 'yes' : 'no'
  else v = recall >= 0.8 ? 'yes' : recall >= 0.6 ? 'close' : 'no'
  // תשובה ארוכה מאוד שרק מכילה את הנכון בין הרבה סתם: נחשבת "כמעט"
  if (v === 'yes' && g.length > e.length * 3 && precision < 0.3) v = 'close'
  return v
}

export const splitAlts = (a?: string) => (a ?? '').split(/[;\n]/).map((x) => x.trim()).filter(Boolean)

const rank: Record<Verdict, number> = { no: 0, close: 1, yes: 2 }

/** בדיקת תשובה לפי רמת הבדיקה של הסט, מול התשובה הצפויה וכל החלופות שהוגדרו לה */
export function gradeWith(level: Level, given: string, expected: string, alts?: string): Verdict {
  const cands = [expected]
  if (/[\/;]/.test(expected)) cands.push(...expected.split(/[\/;]/).map((x) => x.trim()).filter(Boolean))
  cands.push(...splitAlts(alts))
  let best: Verdict = 'no'
  for (const c of cands) {
    const v = level === 'exact' ? grade(given, c) : flex(given, c)
    if (rank[v] > rank[best]) best = v
    if (best === 'yes') break
  }
  return best
}

/** הרמה בפועל של כרטיסייה: אם הוגדרה לה רמה משלה היא קובעת, אחרת הרמה של הסט */
export const cardLevel = (c: { grading?: Level | null }, setLevel: Level): Level => c.grading ?? setLevel

export const LEVEL_LABELS: Record<Level, string> = {
  exact: 'מדויק: השוואת טקסט',
  flexible: 'גמיש: סדר מילים, אותיות שימוש וטעויות קטנות',
  smart: 'חכם: AI בודק לפי משמעות'
}
