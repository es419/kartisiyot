import { ALERT_AT, DB_LIMIT_MB, FILES_LIMIT_MB } from '../config'

export type Usage = { db_bytes: number; files_bytes: number }
export type UsageRow = { kind: 'db' | 'files'; label: string; used: number; limit: number; pct: number; level: 'ok' | 'warn' | 'full' }

const MB = 1024 * 1024
export const fmtMB = (bytes: number) => (bytes >= 100 * MB ? Math.round(bytes / MB) : Math.round((bytes / MB) * 10) / 10) + ' MB'

export function usageRows(u: Usage): UsageRow[] {
  const mk = (kind: 'db' | 'files', label: string, used: number, limitMb: number): UsageRow => {
    const limit = limitMb * MB
    const pct = used / limit
    return { kind, label, used, limit, pct, level: pct >= 1 ? 'full' : pct >= ALERT_AT ? 'warn' : 'ok' }
  }
  return [
    mk('db', 'בסיס נתונים', Number(u.db_bytes) || 0, DB_LIMIT_MB),
    mk('files', 'אחסון קבצים (תמונות)', Number(u.files_bytes) || 0, FILES_LIMIT_MB)
  ]
}
