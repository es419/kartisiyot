import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [dy, setDy] = useState(0)
  const startY = useRef<number | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={dy ? { transform: `translateY(${dy}px)`, transition: 'none', animation: 'none' } : undefined}
      >
        <div
          className="sheet-handle"
          onTouchStart={(e) => { startY.current = e.touches[0].clientY }}
          onTouchMove={(e) => { if (startY.current !== null) setDy(Math.max(0, e.touches[0].clientY - startY.current)) }}
          onTouchEnd={() => { if (dy > 90) onClose(); else setDy(0); startY.current = null }}
        >
          <i />
        </div>
        {children}
      </div>
    </div>
  )
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2200)
    return () => clearTimeout(t)
  }, [msg])
  return { show: setMsg, node: msg ? <div className="toast" role="status">{msg}</div> : null }
}

export const Loading = () => (
  <div className="col" aria-busy="true" aria-label="טוען">
    <div className="skel" style={{ height: 70 }} />
    <div className="skel" style={{ height: 70 }} />
    <div className="skel" style={{ height: 70, width: '70%' }} />
  </div>
)
export const ErrorBox = ({ msg }: { msg: string }) => <div className="error">{msg}</div>
