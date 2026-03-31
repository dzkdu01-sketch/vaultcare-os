import { FormEvent } from 'react'

type LoginFormProps = {
  onSubmit: () => void
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">账号</label>
        <input
          id="username"
          name="username"
          type="text"
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          placeholder="请输入账号"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">密码</label>
        <input
          id="password"
          name="password"
          type="password"
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          placeholder="请输入密码"
        />
      </div>
      <button
        type="submit"
        className="w-full py-2 bg-violet-600 text-white text-sm font-medium rounded-md hover:bg-violet-700 transition-colors cursor-pointer"
      >
        登录
      </button>
    </form>
  )
}
