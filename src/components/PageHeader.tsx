import type { ReactNode } from 'react'
import { Logo } from './Logo'

export default function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="row spread page-head">
      <div className="row">
        <Logo size={34} />
        <h1>{title}</h1>
      </div>
      <div className="row">{children}</div>
    </div>
  )
}
