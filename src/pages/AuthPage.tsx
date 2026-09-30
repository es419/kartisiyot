import { useState, type FormEvent } from 'react'
import { configured, supabase } from '../supabase'
import { Logo } from '../components/Logo'

export default function AuthPage() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!configured) {
    return (
      <div className="page">
        <h1>חסרה הגדרת Supabase</h1>
        <p className="mt-s">צור קובץ <code>.env</code> לפי <code>.env.example</code> עם כתובת הפרויקט ומפתח ה-anon, והפעל מחדש את השרת.</p>
      </div>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (res.error) setMsg(res.error.message)
    else if (mode === 'up' && !res.data.session) setMsg('נשלח מייל אישור. אחרי האישור אפשר להתחבר.')
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <div className="col" style={{ alignItems: 'center', marginTop: 24 }}>
        <Logo size={84} />
        <h1>כרטיסיות</h1>
      </div>
      <div className="index-card" style={{ padding: '24px 20px', marginTop: 22 }}>
        <form className="col" onSubmit={submit}>
          <h2>{mode === 'in' ? 'התחברות' : 'הרשמה'}</h2>
          <label className="field">
            אימייל
            <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </label>
          <label className="field">
            סיסמה
            <input className="input" type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          </label>
          {msg && <div className="error">{msg}</div>}
          <button className="btn primary block" disabled={busy}>{mode === 'in' ? 'התחבר' : 'צור חשבון'}</button>
          <button type="button" className="btn ghost block" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? 'אין לי חשבון' : 'כבר יש לי חשבון'}
          </button>
        </form>
      </div>
    </div>
  )
}
