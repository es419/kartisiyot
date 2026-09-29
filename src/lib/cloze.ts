import type { Card } from '../types'

const RE = /\{\{(.+?)\}\}/g

export const isCloze = (t: string) => /\{\{.+?\}\}/.test(t)

const answerOf = (g: string) => g.split('::').pop()!.trim()

/** כרטיסיית השלמה: "שיעור המס הוא {{23%}}" הופכת לשאלה עם [...] ולתשובה 23% */
export function clozeView(c: Card): Card {
  if (!isCloze(c.term)) return c
  const answers = [...c.term.matchAll(RE)].map((m) => answerOf(m[1]))
  return {
    ...c,
    term: c.term.replace(RE, '[...]'),
    definition: answers.join(', '),
    full: c.term.replace(RE, (_m, g: string) => answerOf(g))
  }
}

export const studyable = (c: Card) => c.term.trim().length > 0 && c.definition.trim().length > 0

export const studyView = (cards: Card[]) => cards.map(clozeView).filter(studyable)
