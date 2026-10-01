export default function AiNote({ text = 'נוצר על ידי AI ועלול להכיל טעויות. כדאי לוודא מול החומר.' }: { text?: string }) {
  return <p className="muted small" style={{ marginTop: 8 }}>{text}</p>
}

/** מתרגם שגיאות של ה-AI להודעה ברורה בעברית */
export function aiErrorText(msg: string): string {
  if (/credit balance|insufficient credit|too low|CREDIT_LOW|payment required|\b402\b/i.test(msg)) {
    return 'נגמר הקרדיט ב-Anthropic. הטען קרדיט בקונסולה (Settings, ואז Billing) ונסה שוב.'
  }
  if (/fc-magic|לא פרוסה|Failed to send|non-2xx/i.test(msg)) {
    return 'תכונות ה-AI דורשות פריסה חד-פעמית של הפונקציה fc-magic ב-Supabase ומפתח API. ההוראות ב-README.'
  }
  if (/ANTHROPIC_API_KEY|x-api-key|invalid api key|authentication_error/i.test(msg)) {
    return 'מפתח ה-API חסר או לא תקין. בדוק את הסוד ANTHROPIC_API_KEY ב-Supabase ופרוס את הפונקציה מחדש.'
  }
  if (/rate.?limit|overloaded|\b429\b|\b529\b/i.test(msg)) {
    return 'שירות ה-AI עמוס כרגע. נסה שוב בעוד רגע.'
  }
  if (/timeout/i.test(msg)) return 'בדיקת ה-AI לקחה יותר מדי זמן.'
  return msg
}

/** הודעה למצבים שבהם ה-AI נכשל והאפליקציה ממשיכה בבדיקה הגמישה */
export const aiFallbackText = (msg: string) => aiErrorText(msg) + ' התשובה נבדקה בבדיקה הגמישה.'
