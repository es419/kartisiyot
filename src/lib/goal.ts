export function getGoal(): number {
  const v = Number(localStorage.getItem('fc:goal'))
  return v > 0 ? v : 20
}
export function setGoal(n: number) {
  try {
    localStorage.setItem('fc:goal', String(Math.max(1, Math.min(500, Math.round(n)))))
  } catch {
    /* ignore */
  }
}
