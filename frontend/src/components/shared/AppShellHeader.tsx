import { useContext, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
  X,
} from 'lucide-react'
import { PageHeaderContext } from '../../context/PageHeaderContext'
import { primaryNavigation } from '../../constants/navigation'
import { shellHeaderBarMinH, shellHeaderInner } from './shellHeaderClasses'
import { getSessionUser, clearAuth } from '../../app/store/auth-store'

function NavDivider() {
  return <span className="hidden h-8 w-px shrink-0 bg-white/25 sm:block" aria-hidden />
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'shell-nav-focus rounded-lg px-3 py-2 text-[15px] font-medium leading-snug tracking-tight transition-colors sm:px-4 sm:py-2.5 sm:text-base',
    isActive
      ? 'bg-white/15 text-white shadow-sm'
      : 'text-white/90 hover:bg-white/10 hover:text-white',
  ].join(' ')

const ROOT_SHELL_PATHS = new Set(['/products', '/products/catalog', '/orders', '/orders/new', '/suppliers', '/settings', '/my-sites'])

const pageTitles: Record<string, string> = {
  '/products': '产品管理',
  '/products/new': '新建产品',
  '/products/catalog': '客户图册',
  '/orders': '订单中心',
  '/orders/new': '新建订单',
  '/suppliers': '供应商管理',
  '/settings': '管理中心',
  '/my-sites': '我的网站',
}

function resolveTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (/^\/products\/[^/]+\/edit$/.test(pathname)) return '编辑产品'
  if (pathname.startsWith('/products/')) return '产品详情'
  if (/^\/orders\/[^/]+\/edit$/.test(pathname)) return '编辑订单'
  if (pathname.startsWith('/orders/')) return '订单详情'
  return 'Vaultcare'
}

/**
 * 顶栏：品牌 + 主导航 + 标题区 + 快捷入口 + 工具（单行，约 72px 高，对齐 Spaceship 式模板比例）。
 */
export function AppShellHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pageHeader = useContext(PageHeaderContext)
  const subtitle = pageHeader?.subtitle ?? null
  const headerActions = pageHeader?.headerActions
  const showBack = !ROOT_SHELL_PATHS.has(pathname)
  const currentUser = getSessionUser()
  const homePath = currentUser?.role === 'distributor' ? '/settings' : '/products'
  const isOp = currentUser?.role === 'operator'
  const isDistributor = currentUser?.role === 'distributor'
  const visibleNav = primaryNavigation.filter(item =>
    (!item.operatorOnly || isOp) && (!item.distributorOnly || isDistributor)
  )

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <>
      <header className="shrink-0 border-b border-white/10 bg-shell-nav text-white shadow-sm">
        <div className={`${shellHeaderInner} ${shellHeaderBarMinH} gap-3 sm:gap-4`}>
          {/* 左：品牌 + 主导航 */}
          <div className="flex min-w-0 shrink-0 items-center gap-3 sm:gap-4">
            <Link
              to={homePath}
              className="shell-nav-focus flex shrink-0 items-center gap-2.5 rounded-lg py-1 text-white"
              onClick={() => setMobileOpen(false)}
            >
              <img src="/logo-mark.svg" alt="" width={36} height={36} className="h-9 w-9" />
              <span className="hidden text-[17px] font-semibold leading-none tracking-tight sm:inline">
                vaultcare
              </span>
            </Link>
            <NavDivider />
            <nav className="hidden min-w-0 items-center gap-1.5 md:flex" aria-label="主导航">
              {visibleNav.map(item => (
                <NavLink key={item.path} to={item.path} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* 中：返回 + 标题（占满剩余宽度） */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden border-l border-white/20 pl-3 sm:gap-3 sm:pl-4">
            {showBack ? (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="shell-nav-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12 text-white hover:bg-white/18"
                aria-label="返回上一页"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
              </button>
            ) : null}
            <div className="min-w-0 flex-1 py-0.5">
              <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-white sm:text-lg md:text-xl">
                {resolveTitle(pathname)}
              </h1>
              {subtitle ? (
                <p
                  className="truncate font-sku text-[11px] leading-tight text-white/75 sm:text-xs"
                  title={subtitle}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {/* 右：胶囊 + 工具 + 页面级操作 */}
          <div className="flex min-w-0 shrink-0 items-center">
            {(isOp || isDistributor) && (
              <div className="hidden items-center gap-2 border-l border-white/25 pl-3 md:flex">
                {isOp && (
                  <NavLink
                    to="/products/catalog"
                    className={({ isActive }) =>
                      [
                        'shell-nav-focus inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white/12 text-white/95 hover:bg-white/18',
                      ].join(' ')
                    }
                  >
                    <BookOpen className="h-4 w-4 shrink-0" strokeWidth={2} />
                    客户图册
                  </NavLink>
                )}
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    [
                      'shell-nav-focus inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-white/12 text-white/95 hover:bg-white/18',
                    ].join(' ')
                  }
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" strokeWidth={2} />
                  管理中心
                </NavLink>
              </div>
            )}

            <div className="flex items-center gap-0.5 border-l border-white/25 pl-2 sm:gap-1 sm:pl-3">
              {currentUser && (
                <span className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/90 sm:inline-flex">
                  <User className="h-4 w-4" strokeWidth={2} />
                  {currentUser.name}
                  <span className="text-xs text-white/60">
                    ({currentUser.role === 'operator' ? '操作员' : '分销商'})
                  </span>
                </span>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="shell-nav-focus hidden cursor-pointer rounded-lg p-3 text-white/90 hover:bg-white/10 sm:inline-flex"
                aria-label="退出登录"
              >
                <LogOut className="h-5 w-5" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                className="shell-nav-focus inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md text-white md:hidden"
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav-panel"
                onClick={() => setMobileOpen(o => !o)}
              >
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                <span className="sr-only">{mobileOpen ? '关闭菜单' : '打开菜单'}</span>
              </button>
            </div>

            {headerActions ? (
              <div className="ml-1 flex max-w-[min(100%,18rem)] flex-wrap items-center justify-end gap-2 border-l border-white/25 pl-3 text-slate-900 sm:ml-2 sm:max-w-none [&_button]:shadow-sm [&_button.bg-primary]:text-white">
                {headerActions}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="导航菜单">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            tabIndex={-1}
            aria-label="关闭菜单背景"
            onClick={() => setMobileOpen(false)}
          />
          <nav
            id="mobile-nav-panel"
            className="absolute left-0 right-0 top-[4.5rem] z-50 border-b border-white/10 bg-shell-nav py-4 shadow-lg"
          >
            <ul className="mx-auto flex w-full max-w-[1600px] flex-col gap-1 px-5 sm:px-6 lg:px-10">
              {visibleNav.map(item => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      [
                        'block rounded-lg px-4 py-3.5 text-lg font-medium',
                        isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10',
                      ].join(' ')
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              {(isOp || isDistributor) && (
                <>
                  <li className="mt-2 border-t border-white/10 pt-2">
                    <NavLink
                      to="/settings"
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-3 rounded-lg px-4 py-3.5 text-lg font-medium',
                          isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10',
                        ].join(' ')
                      }
                      onClick={() => setMobileOpen(false)}
                    >
                      <LayoutDashboard className="h-6 w-6 shrink-0 opacity-90" strokeWidth={2} />
                      管理中心
                    </NavLink>
                  </li>
                  {isOp && (
                    <li>
                      <NavLink
                        to="/products/catalog"
                        className={({ isActive }) =>
                          [
                            'flex items-center gap-3 rounded-lg px-4 py-3.5 text-lg font-medium',
                            isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10',
                          ].join(' ')
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <BookOpen className="h-6 w-6 shrink-0 opacity-90" strokeWidth={2} />
                        客户图册
                      </NavLink>
                    </li>
                  )}
                </>
              )}
            </ul>
          </nav>
        </div>
      ) : null}
    </>
  )
}
