import type { Progress } from '../types'

// FSRS-4.5: אלגוריתם החזרה המרווחת המודרני (בסיס Anki החדש). תשובה נכונה = Good, שגויה = Again.
const DAY = 24 * 60 * 60 * 1000
const MIN = 60 * 1000
const W = [0.5701, 1.4436, 4.1386, 10.9355, 5.1443, 1.2006, 0.8627, 0.0362, 1.629, 0.1342, 1.0166, 2.1174, 0.0839, 0.3204, 1.4676, 0.219, 2.8237]
const DECAY = -0.5
const FACTOR = 19 / 81
const LEGACY_DAYS = [0.5, 1, 3, 7, 14, 30] // המרה מהמערכת הישנה (קופסאות)

export const BOX_LABELS = ['בלמידה', 'התחלתי', 'מכיר', 'כמעט', 'טוב', 'שולט']

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
export const retrievability = (days: number, s: number) => Math.pow(1 + (FACTOR * days) / s, DECAY)
const d0 = (g: number) => clamp(W[4] - W[5] * (g - 3), 1, 10)

function boxOf(s: number): number {
  return s < 1 ? 0 : s < 3 ? 1 : s < 7 ? 2 : s < 15 ? 3 : s < 30 ? 4 : 5
}

export function nextProgress(prev: Progress | undefined, ok: boolean, cardId: string, setId: string): Progress {
  const now = Date.now()
  const g = ok ? 3 : 1
  let st: { s: number; d: number; t: number } | null = null
  if (prev?.stability != null && prev.difficulty != null && prev.last_review) {
    st = { s: prev.stability, d: prev.difficulty, t: Math.max(0, (now - new Date(prev.last_review).getTime()) / DAY) }
  } else if (prev && prev.correct + prev.wrong > 0) {
    st = { s: LEGACY_DAYS[prev.box] ?? 1, d: 5, t: 0 }
  }

  let s: number
  let d: number
  let lapses = prev?.lapses ?? 0
  if (!st) {
    s = W[g - 1]
    d = d0(g)
    if (!ok) lapses += 1
  } else {
    const r = retrievability(st.t, st.s)
    d = clamp(W[7] * d0(3) + (1 - W[7]) * (st.d - W[6] * (g - 3)), 1, 10)
    if (ok) {
      s = st.s * (1 + Math.exp(W[8]) * (11 - st.d) * Math.pow(st.s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1))
    } else {
      s = Math.min(st.s, W[11] * Math.pow(st.d, -W[12]) * (Math.pow(st.s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]))
      lapses += 1
    }
  }
  s = clamp(s, 0.1, 36500)

  return {
    card_id: cardId,
    set_id: setId,
    box: ok ? boxOf(s) : 0,
    due_at: new Date(ok ? now + Math.max(1, Math.round(s)) * DAY : now + 10 * MIN).toISOString(),
    correct: (prev?.correct ?? 0) + (ok ? 1 : 0),
    wrong: (prev?.wrong ?? 0) + (ok ? 0 : 1),
    stability: s,
    difficulty: d,
    last_review: new Date(now).toISOString(),
    reps: (prev?.reps ?? 0) + 1,
    lapses
  }
}
