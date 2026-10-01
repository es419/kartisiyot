import { invokeAi } from './api'
import type { AiQuestion } from './types'
import type { Verdict } from './lib/text'

/** בדיקת תשובות מוקלדות לפי משמעות ולא לפי דמיון טקסט */
export async function aiGrade(items: { q: string; expected: string; given: string }[]): Promise<Verdict[]> {
  const d = await invokeAi<{ verdicts: string[] }>({ action: 'grade', items })
  return items.map((_, i) => {
    const v = d.verdicts?.[i]
    return v === 'yes' || v === 'close' ? v : 'no'
  })
}

export type Source = { cards?: { term: string; definition: string }[]; text?: string }

export async function aiTest(input: Source & { count: number }): Promise<AiQuestion[]> {
  const d = await invokeAi<{ questions: AiQuestion[] }>({ action: 'test', ...input })
  return d.questions ?? []
}

export type Guide = { title: string; sections: { heading: string; points: string[] }[]; questions: { q: string; a: string }[] }
export async function aiGuide(input: Source): Promise<Guide> {
  const d = await invokeAi<{ guide: Guide }>({ action: 'guide', ...input })
  return d.guide
}

export type Solution = { steps: { title: string; body: string }[]; answer: string }
export async function aiSolve(input: { text?: string; image_base64?: string }): Promise<Solution> {
  const d = await invokeAi<{ solution: Solution }>({ action: 'solve', ...input })
  return d.solution
}
