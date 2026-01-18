// Authentication utilities

export interface User {
  id: string
  email: string
  createdAt: string
  updatedAt?: string
}

export interface AuthResponse {
  user: User
  token: string
}

// Get the stored token
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

// Get the stored user
export const getUser = (): User | null => {
  if (typeof window === 'undefined') return null
  const userStr = localStorage.getItem('user')
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!getToken()
}

// Clear auth data (logout)
export const logout = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

// Store auth data
export const setAuthData = (token: string, user: User) => {
  if (typeof window === 'undefined') return
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

// Get authorization headers for API calls
export const getAuthHeaders = (): HeadersInit => {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// API helper with authentication (includes credentials for httpOnly cookies)
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = getToken()
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include httpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  
  // If unauthorized, clear auth data
  if (response.status === 401) {
    logout()
  }
  
  return response
}

// Logout from API (clears httpOnly cookie on server)
export const logoutFromAPI = async (apiUrl: string) => {
  try {
    await fetch(`${apiUrl}/api/users/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    // Always clear local storage even if API call fails
    logout()
  }
}

