export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="כרטיסיות" style={{ flex: 'none' }}>
      <rect width="512" height="512" rx="112" fill="#1F3FBF" />
      <g transform="rotate(-9 256 262)"><rect x="100" y="132" width="312" height="252" rx="28" fill="#9DB4F0" /></g>
      <g transform="rotate(3 256 262)">
        <rect x="96" y="128" width="320" height="262" rx="28" fill="#FFFFFF" stroke="#14213D" strokeWidth="10" />
        <path d="M101 196H411" stroke="#E0453A" strokeWidth="9" />
        <path d="M124 262H388M124 324H388" stroke="#B9C8EE" strokeWidth="7" strokeLinecap="round" />
        <rect x="190" y="230" width="132" height="122" rx="14" fill="#FFE45C" />
        <path d="M220 262H270Q292 262 292 284V308Q292 330 270 330H220" fill="none" stroke="#14213D" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export function Splash() {
  return (
    <div className="splash">
      <Logo size={96} />
      <span>כרטיסיות</span>
    </div>
  )
}
