import { useContext } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeaderContext } from '../../context/PageHeaderContext'

const pageTitles: Record<string, string> = {
  '/products': '产品管理',
  '/products/new': '新建产品',
  '/orders': '订单中心',
  '/suppliers': '供应商管理',
  '/settings': '站点设置',
}

function resolveTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (/^\/products\/[^/]+\/edit$/.test(pathname)) return '编辑产品'
  if (pathname.startsWith('/products/')) return '产品详情'
  if (pathname.startsWith('/orders/')) return '订单详情'
  return 'Vaultcare'
}

export function AppTopbar() {
  const { pathname } = useLocation()
  const pageHeader = useContext(PageHeaderContext)
  const subtitle = pageHeader?.subtitle
  const headerActions = pageHeader?.headerActions

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-500">Vaultcare Lite</p>
        <h1 className="text-xl font-semibold text-slate-900">{resolveTitle(pathname)}</h1>
        {subtitle ? (
          <p
            className="mt-1 truncate font-mono text-sm text-slate-500"
            title={subtitle}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {headerActions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5">
          {headerActions}
        </div>
      ) : null}
    </header>
  )
}
