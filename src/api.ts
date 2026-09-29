import { supabase } from './supabase'
import type { Activity, Card, Entry, Folder, Progress, SetRow } from './types'
import { todayStr } from './lib/text'
import { studyView } from './lib/cloze'

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** קריאה עם גיבוי מקומי: אם אין רשת מחזירים את הנתונים האחרונים ששמרנו */
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  try {
    const v = await fn()
    try {
      localStorage.setItem('fc:' + key, JSON.stringify(v))
    } catch {
      /* מלא */
    }
    return v
  } catch (e) {
    const raw = localStorage.getItem('fc:' + key)
    if (raw) return JSON.parse(raw) as T
    throw e
  }
}

export async function userId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('לא מחובר')
  return id
}

// ---------- תיקיות ----------
export const listFolders = () =>
  cached('folders', async () => {
    const uid = await userId()
    return must(await supabase.from('fc_folders').select('*').eq('user_id', uid).order('name')) as Folder[]
  })

export async function createFolder(name: string) {
  return must(await supabase.from('fc_folders').insert({ name }).select().single()) as Folder
}
export async function renameFolder(id: string, name: string) {
  must(await supabase.from('fc_folders').update({ name }).eq('id', id).select())
}
export async function deleteFolder(id: string) {
  must(await supabase.from('fc_folders').delete().eq('id', id).select())
}

// ---------- סטים ----------
export const listSets = () =>
  cached('sets', async () => {
    const uid = await userId()
    const rows = must(
      await supabase.from('fc_sets').select('*, fc_cards(count)').eq('user_id', uid).order('updated_at', { ascending: false })
    ) as (SetRow & { fc_cards: { count: number }[] })[]
    return rows.map((r) => ({ ...r, card_count: r.fc_cards?.[0]?.count ?? 0 })) as SetRow[]
  })

export const getSet = (id: string) =>
  cached('set:' + id, async () => must(await supabase.from('fc_sets').select('*').eq('id', id).single()) as SetRow)

export async function createSet(title = 'סט חדש', folder_id: string | null = null) {
  return must(await supabase.from('fc_sets').insert({ title, folder_id }).select().single()) as SetRow
}
export async function updateSet(id: string, patch: Partial<SetRow>) {
  must(await supabase.from('fc_sets').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select())
}
export async function deleteSet(id: string) {
  must(await supabase.from('fc_sets').delete().eq('id', id).select())
}

export async function copySet(id: string): Promise<SetRow> {
  const src = must(await supabase.from('fc_sets').select('*').eq('id', id).single()) as SetRow
  const cards = must(await supabase.from('fc_cards').select('*').eq('set_id', id).order('position')) as Card[]
  const created = must(
    await supabase
      .from('fc_sets')
      .insert({ title: src.title + ' (עותק)', description: src.description, term_lang: src.term_lang, def_lang: src.def_lang })
      .select()
      .single()
  ) as SetRow
  if (cards.length) {
    must(
      await supabase.from('fc_cards').insert(
        cards.map((c, i) => ({ set_id: created.id, term: c.term, definition: c.definition, image_url: c.image_url, position: i }))
      ).select()
    )
  }
  return created
}

// ---------- כרטיסיות ----------
export const listCards = (setId: string) =>
  cached('cards:' + setId, async () =>
    must(await supabase.from('fc_cards').select('*').eq('set_id', setId).order('position').order('created_at')) as Card[]
  )

export async function insertCard(setId: string, position: number, term = '', definition = '') {
  return must(await supabase.from('fc_cards').insert({ set_id: setId, position, term, definition }).select().single()) as Card
}

export async function insertCards(setId: string, pairs: { term: string; definition: string }[]) {
  const last = must(
    await supabase.from('fc_cards').select('position').eq('set_id', setId).order('position', { ascending: false }).limit(1)
  ) as { position: number }[]
  let pos = (last[0]?.position ?? -1) + 1
  const rows = pairs.map((p) => ({ set_id: setId, term: p.term, definition: p.definition, position: pos++ }))
  for (let i = 0; i < rows.length; i += 200) {
    must(await supabase.from('fc_cards').insert(rows.slice(i, i + 200)).select())
  }
}

export async function updateCard(id: string, patch: Partial<Card>) {
  must(await supabase.from('fc_cards').update(patch).eq('id', id).select())
}
export async function deleteCard(id: string) {
  must(await supabase.from('fc_cards').delete().eq('id', id).select())
}

// ---------- התקדמות וחזרה מרווחת ----------
export async function getProgress(setId: string): Promise<Record<string, Progress>> {
  const rows = must(await supabase.from('fc_progress').select('*').eq('set_id', setId).limit(5000)) as Progress[]
  return Object.fromEntries(rows.map((r) => [r.card_id, r]))
}

export async function saveProgress(p: Progress) {
  const uid = await userId()
  const row: Record<string, unknown> = { ...p, user_id: uid, updated_at: new Date().toISOString() }
  let res = await supabase.from('fc_progress').upsert(row, { onConflict: 'user_id,card_id' }).select()
  if (res.error && /column|schema cache/i.test(res.error.message)) {
    // המסד עוד לא עודכן ל-FSRS: שומרים בפורמט הישן
    const { stability: _s, difficulty: _d, last_review: _l, reps: _r, lapses: _p, ...legacy } = row
    res = await supabase.from('fc_progress').upsert(legacy, { onConflict: 'user_id,card_id' }).select()
  }
  if (res.error) throw new Error(res.error.message)
}

export async function dueCards(limit = 30): Promise<{ cards: Card[]; progress: Record<string, Progress> }> {
  const uid = await userId()
  const rows = must(
    await supabase
      .from('fc_progress')
      .select('*, fc_cards(*)')
      .eq('user_id', uid)
      .lte('due_at', new Date().toISOString())
      .order('due_at')
      .limit(limit)
  ) as (Progress & { fc_cards: Card | null })[]
  const cards: Card[] = []
  const progress: Record<string, Progress> = {}
  for (const r of rows) {
    if (!r.fc_cards) continue
    const [view] = studyView([r.fc_cards])
    if (!view) continue
    cards.push(view)
    const { fc_cards: _c, ...p } = r
    progress[r.card_id] = p as Progress
  }
  return { cards, progress }
}

export async function countDue(): Promise<number> {
  const uid = await userId()
  const res = await supabase
    .from('fc_progress')
    .select('card_id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .lte('due_at', new Date().toISOString())
  if (res.error) throw new Error(res.error.message)
  return res.count ?? 0
}

export async function boxCounts(): Promise<number[]> {
  const uid = await userId()
  const res = await Promise.all(
    [0, 1, 2, 3, 4, 5].map((b) =>
      supabase.from('fc_progress').select('card_id', { count: 'exact', head: true }).eq('user_id', uid).eq('box', b)
    )
  )
  return res.map((r) => r.count ?? 0)
}

// ---------- פעילות ורצף ----------
export async function bumpActivity(n: number, c: number) {
  must(await supabase.rpc('fc_bump_activity', { d: todayStr(), n, c }) as never)
}

export async function getActivity(days: number): Promise<Activity[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const uid = await userId()
  return must(
    await supabase.from('fc_activity').select('day,cards,correct').eq('user_id', uid).gte('day', todayStr(since)).order('day')
  ) as Activity[]
}

export function computeStreak(rows: Activity[]): number {
  const days = new Set(rows.filter((r) => r.cards > 0).map((r) => r.day))
  const d = new Date()
  if (!days.has(todayStr(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(todayStr(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

// ---------- תמונות ----------
export async function uploadImage(blob: Blob): Promise<string> {
  const uid = await userId()
  const path = `${uid}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('fc-images').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error(error.message)
  return supabase.storage.from('fc-images').getPublicUrl(path).data.publicUrl
}

// ---------- יומן למידה ----------
export const listEntries = () =>
  cached('entries', async () => {
    const uid = await userId()
    return must(
      await supabase.from('fc_entries').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(1000)
    ) as Entry[]
  })

export async function createEntry(e: Pick<Entry, 'type' | 'title' | 'body' | 'tag'>) {
  return must(await supabase.from('fc_entries').insert(e).select().single()) as Entry
}
export async function updateEntry(id: string, patch: Partial<Entry>) {
  must(await supabase.from('fc_entries').update(patch).eq('id', id).select())
}
export async function deleteEntry(id: string) {
  must(await supabase.from('fc_entries').delete().eq('id', id).select())
}

export async function convertEntryToCard(entry: Entry, setId: string) {
  const last = must(
    await supabase.from('fc_cards').select('position').eq('set_id', setId).order('position', { ascending: false }).limit(1)
  ) as { position: number }[]
  const card = await insertCard(setId, (last[0]?.position ?? -1) + 1, entry.title, entry.body)
  await updateEntry(entry.id, { card_id: card.id })
  return card
}

export async function ensureJournalSet(): Promise<SetRow> {
  const uid = await userId()
  const found = must(
    await supabase.from('fc_sets').select('*').eq('user_id', uid).eq('title', 'יומן למידה').limit(1)
  ) as SetRow[]
  if (found[0]) return found[0]
  const s = await createSet('יומן למידה')
  await updateSet(s.id, { term_lang: 'he-IL', def_lang: 'he-IL' })
  return { ...s, term_lang: 'he-IL', def_lang: 'he-IL' }
}

// ---------- חיפוש, סידור והעברה ----------
export type CardHit = { id: string; term: string; definition: string; set_id: string; set_title: string }

export async function searchCards(q: string): Promise<CardHit[]> {
  const t = q.replace(/[,()%*]/g, ' ').trim()
  if (t.length < 2) return []
  const uid = await userId()
  const rows = must(
    await supabase
      .from('fc_cards')
      .select('id,term,definition,set_id,fc_sets(title)')
      .eq('user_id', uid)
      .or(`term.ilike.*${t}*,definition.ilike.*${t}*`)
      .limit(40)
  ) as unknown as { id: string; term: string; definition: string; set_id: string; fc_sets: { title: string } | null }[]
  return rows.map((r) => ({ id: r.id, term: r.term, definition: r.definition, set_id: r.set_id, set_title: r.fc_sets?.title ?? '' }))
}

export async function reorderCards(ids: string[]) {
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20)
    const res = await Promise.all(chunk.map((id, k) => supabase.from('fc_cards').update({ position: i + k }).eq('id', id)))
    const bad = res.find((r) => r.error)
    if (bad?.error) throw new Error(bad.error.message)
  }
}

export async function duplicateCard(c: Card): Promise<Card> {
  const last = must(
    await supabase.from('fc_cards').select('position').eq('set_id', c.set_id).order('position', { ascending: false }).limit(1)
  ) as { position: number }[]
  return must(
    await supabase
      .from('fc_cards')
      .insert({ set_id: c.set_id, term: c.term, definition: c.definition, image_url: c.image_url, position: (last[0]?.position ?? -1) + 1 })
      .select()
      .single()
  ) as Card
}

export async function moveCard(cardId: string, toSetId: string) {
  const last = must(
    await supabase.from('fc_cards').select('position').eq('set_id', toSetId).order('position', { ascending: false }).limit(1)
  ) as { position: number }[]
  must(await supabase.from('fc_cards').update({ set_id: toSetId, position: (last[0]?.position ?? -1) + 1 }).eq('id', cardId).select())
  await supabase.from('fc_progress').update({ set_id: toSetId }).eq('card_id', cardId)
}

// ---------- יצירת כרטיסיות עם AI (Edge Function אופציונלית) ----------
export async function generateCards(input: { text?: string; pdf_base64?: string; count: number }) {
  const { data, error } = await supabase.functions.invoke('fc-magic', { body: input })
  if (error) {
    const ctx = (error as { context?: Response }).context
    if (ctx?.status === 404) throw new Error('הפונקציה fc-magic עוד לא פרוסה ב-Supabase. ההוראות ב-README.')
    try {
      const j = await ctx?.json()
      if (j?.error) throw new Error(j.error)
    } catch (e) {
      if (e instanceof Error && e.message && !/JSON|Unexpected|body/i.test(e.message)) throw e
    }
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)
  return (data?.cards ?? []) as { term: string; definition: string }[]
}
