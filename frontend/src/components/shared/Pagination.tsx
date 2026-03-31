type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationProps) {
  if (total === 0) return null

  const totalPages = Math.ceil(total / pageSize)
  const isFirst = page <= 1
  const isLast = page >= totalPages

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">
        第 {page} / {totalPages} 页，共 {total} 条
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50${isFirst ? ' cursor-not-allowed opacity-50' : ''}`}
          disabled={isFirst}
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </button>
        <button
          type="button"
          className={`rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50${isLast ? ' cursor-not-allowed opacity-50' : ''}`}
          disabled={isLast}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  )
}
