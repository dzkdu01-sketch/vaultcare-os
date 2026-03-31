type MockUser = {
  id: string
  name: string
}

const STORAGE_KEY = 'vaultcare_mock_user'

function readUser(): MockUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getSessionUser() {
  return readUser()
}

export function signInMockUser() {
  const user: MockUser = { id: 'u-1', name: 'Admin' }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  return user
}

export function signOutMockUser() {
  sessionStorage.removeItem(STORAGE_KEY)
}
