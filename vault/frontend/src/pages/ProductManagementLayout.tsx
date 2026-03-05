import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const productNavItems = [
  { to: '/products/workbench', label: '商品工作台' },
  { to: '/products/entry', label: '录入商品' },
  { to: '/products/batch', label: '批量管理' },
  { to: '/products/tags', label: '标签管理' },
  { to: '/products/categories', label: '品类管理' },
]

export default function ProductManagementLayout() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2">
        {productNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}
