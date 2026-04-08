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
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          placeholder="请输入账号"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">密码</label>
        <input
          id="password"
          name="password"
          type="password"
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          placeholder="请输入密码"
        />
      </div>
      <button
        type="submit"
        className="w-full cursor-pointer rounded-md bg-primary py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
      >
        登录
      </button>
    </form>
  )
}
