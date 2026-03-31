import type { ReactNode } from 'react'

type Column<T extends { id: string }> = {
  key: keyof T
  header: string
}

type DataTableProps<T extends { id: string }> = {
  columns: Array<Column<T>>
  rows: T[]
  onRowClick?: (row: T) => void
  emptyText?: string
}

export function DataTable<T extends { id: string }>({ columns, rows, onRowClick, emptyText = '暂无数据' }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="border-b border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-600"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className={onRowClick ? 'border-b border-slate-100 cursor-pointer hover:bg-slate-50' : 'border-b border-slate-100'}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700"
                  >
                    {row[column.key] as ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
