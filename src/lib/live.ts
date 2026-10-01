import { supabase } from '../supabase'

/** ערוץ Realtime של משחק. כולם מאזינים לאותו קוד, והמארח מחזיק את התשובות הנכונות */
export function liveChannel(code: string, key: string) {
  return supabase.channel('fc-live-' + code, { config: { broadcast: { self: false }, presence: { key } } })
}

export type LiveQ = { i: number; total: number; prompt: string; options: string[]; ms: number }
export type Score = { id: string; name: string; score: number }

export const newCode = () => String(1000 + Math.floor(Math.random() * 9000))
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
