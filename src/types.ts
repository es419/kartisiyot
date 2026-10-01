export type Folder = { id: string; name: string }

/** רמת בדיקה של תשובות מוקלדות: מדויק / גמיש (בלי AI) / חכם (AI לפי משמעות) */
export type Level = 'exact' | 'flexible' | 'smart'

export type SetRow = {
  id: string
  user_id: string
  folder_id: string | null
  title: string
  description: string
  is_public: boolean
  term_lang: string
  def_lang: string
  created_at: string
  updated_at: string
  exam_date: string | null
  listed?: boolean
  grading?: Level
  card_count?: number
}

export type Card = {
  id: string
  set_id: string
  term: string
  definition: string
  image_url: string | null
  position: number
  starred: boolean
  alts?: string // תשובות נוספות שמתקבלות, מופרדות ב-; או בשורה חדשה
  full?: string // תצוגה בלבד: משפט מלא של כרטיסיית השלמה
}

export type Progress = {
  card_id: string
  set_id: string
  box: number
  due_at: string
  correct: number
  wrong: number
  stability?: number | null
  difficulty?: number | null
  last_review?: string | null
  reps?: number
  lapses?: number
}

export type EntryType = 'concept' | 'tool' | 'procedure' | 'contact' | 'question'

export type Entry = {
  id: string
  type: EntryType
  title: string
  body: string
  tag: string
  resolved: boolean
  card_id: string | null
  created_at: string
}

export type Activity = { day: string; cards: number; correct: number }

export type Point = { x: number; y: number; label: string } // x,y בטווח 0..1 ביחס לתמונה

export type Diagram = { id: string; set_id: string; title: string; image_url: string; points: Point[]; created_at: string }

export type AiQuestion = {
  type: 'mc' | 'tf' | 'short'
  q: string
  options?: string[]
  answer: string
  explanation?: string
}
