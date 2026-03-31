import { PropsWithChildren, ReactNode } from 'react'

type PageHeaderProps = PropsWithChildren<{
  title: string
  description?: string
  actions?: ReactNode
}>

export function PageHeader({ title, description, actions, children }: PageHeaderProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        {children}
      </div>
      {actions ? <div>{actions}</div> : null}
    </section>
  )
}
