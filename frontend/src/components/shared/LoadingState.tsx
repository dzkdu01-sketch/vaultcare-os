type LoadingStateProps = {
  message?: string
}

export function LoadingState({ message = '加载中...' }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 shadow-sm">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}
