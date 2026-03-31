import { useNavigate } from 'react-router-dom'
import { signInMockUser } from '../../app/store/auth-store'
import { LoginForm } from '../../modules/auth/components/LoginForm'

export function LoginPage() {
  const navigate = useNavigate()

  const handleSubmit = () => {
    signInMockUser()
    navigate('/products')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-semibold text-center text-slate-800 mb-6">登录</h1>
        <LoginForm onSubmit={handleSubmit} />
      </div>
    </main>
  )
}
