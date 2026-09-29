// Supabase Edge Function (Deno): יוצרת כרטיסיות מטקסט או PDF בעזרת Claude.
// פריסה: supabase functions deploy fc-magic
// מפתח: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// הפונקציה דורשת משתמש מחובר (verify_jwt ברירת מחדל), כך שרק אתה יכול להפעיל אותה.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const SYSTEM = `You create study flashcards from the user's material.
Rules:
- Write in the same language as the material.
- Return ONLY a JSON array, no prose and no code fences: [{"term":"...","definition":"..."}]
- Each card tests one idea. Terms are short; definitions are concise and self-contained.
- For a fact inside a sentence you may make a cloze card: put the hidden part in double braces inside "term", e.g. "The VAT rate is {{18%}}", and leave "definition" as an empty string.
- Use $...$ for math formulas.
- Do not invent facts that are not in the material.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY')
    if (!key) return json({ error: 'חסר ANTHROPIC_API_KEY בסודות של Supabase' }, 500)

    const { text, pdf_base64, count } = await req.json()
    const n = Math.max(3, Math.min(60, Number(count) || 15))

    const content: unknown[] = []
    if (typeof pdf_base64 === 'string' && pdf_base64.length > 0) {
      if (pdf_base64.length > 6_000_000) return json({ error: 'ה-PDF גדול מדי' }, 413)
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } })
    } else if (typeof text === 'string' && text.trim().length > 0) {
      content.push({ type: 'text', text: `Material:\n\n${text.slice(0, 30000)}` })
    } else {
      return json({ error: 'לא התקבל חומר' }, 400)
    }
    content.push({ type: 'text', text: `Create up to ${n} flashcards from the material above.` })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: 'user', content }]
      })
    })
    if (!res.ok) {
      const t = await res.text()
      return json({ error: `שגיאה מה-API (${res.status}): ${t.slice(0, 200)}` }, 502)
    }
    const data = await res.json()
    const raw: string = (data.content ?? []).map((b: { text?: string }) => b.text ?? '').join('')
    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    const parsed = JSON.parse(raw.slice(start, end + 1))
    const cards = (Array.isArray(parsed) ? parsed : [])
      .map((c: { term?: unknown; definition?: unknown }) => ({ term: String(c.term ?? '').trim(), definition: String(c.definition ?? '').trim() }))
      .filter((c: { term: string; definition: string }) => c.term && (c.definition || /\{\{.+?\}\}/.test(c.term)))
      .slice(0, n)
    return json({ cards })
  } catch (e) {
    return json({ error: `שגיאה: ${(e as Error).message}` }, 500)
  }
})
