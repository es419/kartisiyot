export type Folder = { id: string; name: string }

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
