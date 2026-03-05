import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Globe,
  TrendingUp,
  Truck,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/', label: '看板', icon: LayoutDashboard, end: true },
  { to: '/products/workbench', label: '商品管理', icon: Package },
  { to: '/orders', label: '订单中心', icon: ShoppingCart },
  { to: '/distributors', label: '分销商', icon: Users },
  { to: '/distributor-selections', label: '分销选品', icon: Users },
  { to: '/suppliers', label: '供应商', icon: Truck },
  { to: '/wp-sites', label: 'WP站点', icon: Globe },
  { to: '/finance', label: '财务看板', icon: TrendingUp },
  { to: '/settings/ai', label: 'AI 配置', icon: Settings },
]

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-neutral-50/50 border-r border-neutral-200/80 w-64 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-neutral-200">
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-2 shadow-sm">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <span className="font-bold text-base text-neutral-900">Vaultcare OS</span>
          <p className="text-xs text-neutral-500">中台系统</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-neutral-400 hover:text-neutral-900 transition-colors">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20'
                  : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
              )
            }
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-4 py-4 border-t border-neutral-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-[15px] font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-all duration-200"
        >
          <LogOut className="h-5 w-5" />
          退出登录
        </button>
      </div>
    </div>
  )
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative flex h-full w-64">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-4 bg-white/80 backdrop-blur-md border-b border-neutral-200/80">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg p-1">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-[15px] text-neutral-900">Vaultcare OS</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
