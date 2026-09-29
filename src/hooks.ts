import { useCallback, useEffect, useRef, useState } from 'react'
import { bumpActivity, getProgress, getSet, listCards } from './api'
import { studyView } from './lib/cloze'
import type { Card, Progress, SetRow } from './types'

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fn()
      .then((d) => {
        if (alive) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, error, loading, reload: () => setTick((t) => t + 1), setData }
}

/** טוען סט + כרטיסיות תקינות + התקדמות, לשימוש במצבי הלימוד */
export function useStudy(setId: string, starredOnly: boolean) {
  const q = useLoad(async () => {
    const [set, all, progress] = await Promise.all([
      getSet(setId),
      listCards(setId),
      getProgress(setId).catch(() => ({} as Record<string, Progress>))
    ])
    let cards = studyView(all)
    if (starredOnly) cards = cards.filter((c) => c.starred)
    return { set: set as SetRow, cards: cards as Card[], progress }
  }, [setId, starredOnly])
  return q
}

/** צובר כמה כרטיסיות נלמדו ושולח לשרת בסוף / ביציאה */
export function useActivity() {
  const r = useRef({ n: 0, c: 0 })
  const flush = useCallback(() => {
    const { n, c } = r.current
    if (n > 0) {
      r.current = { n: 0, c: 0 }
      bumpActivity(n, c).catch(() => {})
    }
  }, [])
  useEffect(() => () => flush(), [flush])
  const add = useCallback((ok: boolean) => {
    r.current.n++
    if (ok) r.current.c++
  }, [])
  return { add, flush }
}

/** גובה החלון הנראה (מתכווץ כשהמקלדת פתוחה באייפון) */
export function useViewportHeight() {
  const [h, setH] = useState(() => window.visualViewport?.height ?? window.innerHeight)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const f = () => setH(vv.height)
    vv.addEventListener('resize', f)
    vv.addEventListener('scroll', f)
    return () => {
      vv.removeEventListener('resize', f)
      vv.removeEventListener('scroll', f)
    }
  }, [])
  return h
}
