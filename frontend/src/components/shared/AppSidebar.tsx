import { NavLink } from 'react-router-dom'
import { primaryNavigation } from '../../constants/navigation'

export function AppSidebar() {
  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white px-4 py-6">
      <div className="mb-6 text-lg font-semibold text-slate-900">Vaultcare</div>
      <nav>
        <ul className="space-y-1">
          {primaryNavigation.map((item) => (
            <li key={item.path}>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? 'block rounded-xl px-4 py-3 text-sm font-medium text-white bg-violet-600 shadow-md shadow-violet-600/20'
                    : 'block rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }
                to={item.path}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
