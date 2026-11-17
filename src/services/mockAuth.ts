export type MockUser = {
  email: string
  name: string
  role: 'Global Administrator'
}

export const SESSION_STORAGE_KEY = 'lebati-demo-session'

export const mockAdminUser: MockUser = {
  email: 'bnombamba@icloud.com',
  name: 'Bongani Nombamba',
  role: 'Global Administrator',
}

export function validateMockCredentials(email: string, password: string): MockUser | null {
  const normalisedEmail = email.trim().toLowerCase()

  if (normalisedEmail !== mockAdminUser.email.toLowerCase()) {
    return null
  }

  if (password !== currentMockPassword) {
    return null
  }

  return { ...mockAdminUser }
}

// Memory-only demonstration. Reloading the application restores the demo password.
let currentMockPassword = '12345678'
export function resetWorkspacePassword(next: string) {
  currentMockPassword = next
}

export function changeMockPassword(current: string, next: string) {
  if (current !== currentMockPassword) throw new Error('Current password is incorrect.')
  if (next.length < 8 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next)) throw new Error('Use at least 8 characters, uppercase, lowercase and a number.')
  if (current === next) throw new Error('Choose a different new password.')
  resetWorkspacePassword(next)
}
export function logout() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  void fetch('/api/ai/session', { method: 'DELETE', credentials: 'same-origin', keepalive: true }).catch(() => {})
}

export function persistAuthenticatedUser(user: MockUser) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    email: user.email,
    name: user.name,
    role: user.role,
  }))
}

export function getStoredSessionUser(): MockUser | null {
  if (typeof window === 'undefined') {
    return null
  }

  const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!stored) {
    return null
  }

  try {
    const parsed = JSON.parse(stored) as Partial<MockUser>
    if (typeof parsed.email !== 'string' || typeof parsed.name !== 'string' || parsed.role !== 'Global Administrator') {
      return null
    }

    return {
      email: parsed.email,
      name: parsed.name,
      role: parsed.role as MockUser['role'],
    }
  } catch {
    return null
  }
}
