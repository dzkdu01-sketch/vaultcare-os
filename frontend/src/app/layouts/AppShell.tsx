import { PropsWithChildren } from 'react'
import { AppShellHeader } from '../../components/shared/AppShellHeader'
import { PageHeaderProvider } from '../../context/PageHeaderContext'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-page text-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-primary focus:shadow-lg"
      >
        跳到主内容
      </a>
      <PageHeaderProvider>
        <div className="flex min-h-0 flex-1 flex-col">
          <AppShellHeader />
          <main
            id="main-content"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 md:p-8 lg:p-10"
          >
            {children}
          </main>
        </div>
      </PageHeaderProvider>
    </div>
  )
}
