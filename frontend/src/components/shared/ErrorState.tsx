type ErrorStateProps = {
  message?: string
}

export function ErrorState({ message = '加载失败，请刷新重试。' }: ErrorStateProps) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-red-100 bg-red-50 px-6 py-12 shadow-sm">
      <p className="text-sm text-red-600">{message}</p>
    </div>
  )
}
