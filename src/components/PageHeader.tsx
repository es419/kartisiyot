import type { ReactNode } from 'react'
import { Logo } from './Logo'

export default function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="row spread page-head">
      <div className="row">
        <Logo size={32} />
        <h1>{title}</h1>
      </div>
      <div className="row" style={{ gap: 2 }}>{children}</div>
    </div>
  )
}
