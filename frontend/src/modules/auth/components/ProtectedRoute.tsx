import { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getSessionUser } from '../../../app/store/auth-store'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation()
  const user = getSessionUser()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

export function OperatorRoute({ children }: PropsWithChildren) {
  const user = getSessionUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'operator') {
    return <Navigate to="/orders" replace />
  }

  return <>{children}</>
}
