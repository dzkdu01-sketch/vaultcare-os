import { PropsWithChildren } from 'react'
import { AppSidebar } from '../../components/shared/AppSidebar'
import { AppTopbar } from '../../components/shared/AppTopbar'
import { PageHeaderProvider } from '../../context/PageHeaderContext'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 text-slate-900">
      <div className="flex min-h-0 flex-1">
        <AppSidebar />
        <PageHeaderProvider>
          <div className="flex min-h-0 flex-1 flex-col">
            <AppTopbar />
            <main className="flex flex-1 flex-col min-h-0 overflow-y-auto p-6 md:p-8 lg:p-10">{children}</main>
          </div>
        </PageHeaderProvider>
      </div>
    </div>
  )
}
