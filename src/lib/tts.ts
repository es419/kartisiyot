export function speak(text: string, lang: string, rate = 0.95) {
  if (!('speechSynthesis' in window) || !text.trim()) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = rate
  window.speechSynthesis.speak(u)
}

export const LANGS: { code: string; label: string }[] = [
  { code: 'he-IL', label: 'עברית' },
  { code: 'en-US', label: 'אנגלית (US)' },
  { code: 'en-GB', label: 'אנגלית (UK)' },
  { code: 'ar-SA', label: 'ערבית' },
  { code: 'es-ES', label: 'ספרדית' },
  { code: 'fr-FR', label: 'צרפתית' },
  { code: 'de-DE', label: 'גרמנית' },
  { code: 'ru-RU', label: 'רוסית' }
]
