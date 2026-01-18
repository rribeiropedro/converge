# Authentication Usage Guide

## Overview
This guide explains how to use the authentication system in the Converge frontend.

## Environment Variables

Create a `.env.local` file in the frontend directory:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Auth Utilities (`lib/auth.ts`)

### Available Functions

#### `getToken(): string | null`
Get the stored JWT token from localStorage.

```typescript
import { getToken } from '@/lib/auth'

const token = getToken()
```

#### `getUser(): User | null`
Get the stored user object from localStorage.

```typescript
import { getUser } from '@/lib/auth'

const user = getUser()
console.log(user?.email)
```

#### `isAuthenticated(): boolean`
Check if a user is currently authenticated.

```typescript
import { isAuthenticated } from '@/lib/auth'

if (isAuthenticated()) {
  // User is logged in
}
```

#### `logout()`
Clear authentication data (logout the user).

```typescript
import { logout } from '@/lib/auth'

logout()
router.push('/auth')
```

#### `setAuthData(token: string, user: User)`
Store authentication data (used internally by auth page).

```typescript
import { setAuthData } from '@/lib/auth'

setAuthData(data.token, data.user)
```

#### `getAuthHeaders(): HeadersInit`
Get headers with authentication token for API calls.

```typescript
import { getAuthHeaders } from '@/lib/auth'

const response = await fetch(`${API_URL}/api/connections`, {
  headers: getAuthHeaders()
})
```

#### `fetchWithAuth(url: string, options?: RequestInit)`
Fetch wrapper that automatically includes authentication headers and handles 401 errors.

```typescript
import { fetchWithAuth } from '@/lib/auth'

const response = await fetchWithAuth(`${API_URL}/api/users/me`)
const data = await response.json()
```

## Usage in Components

### Protecting Routes

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'

export default function ProtectedPage() {
  const router = useRouter()
  
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/auth')
    }
  }, [router])
  
  return <div>Protected Content</div>
}
```

### Making Authenticated API Calls

```typescript
import { fetchWithAuth } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Get current user
const response = await fetchWithAuth(`${API_URL}/api/users/me`)
const { user } = await response.json()

// Create a connection
const response = await fetchWithAuth(`${API_URL}/api/connections`, {
  method: 'POST',
  body: JSON.stringify({ /* data */ })
})
```

### Displaying User Info

```typescript
'use client'

import { getUser } from '@/lib/auth'

export default function UserProfile() {
  const user = getUser()
  
  if (!user) return <div>Not logged in</div>
  
  return (
    <div>
      <p>Email: {user.email}</p>
      <p>Member since: {new Date(user.createdAt).toLocaleDateString()}</p>
    </div>
  )
}
```

### Logout Button

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { logout } from '@/lib/auth'
import { Button } from '@/components/ui/button'

export default function LogoutButton() {
  const router = useRouter()
  
  const handleLogout = () => {
    logout()
    router.push('/auth')
  }
  
  return <Button onClick={handleLogout}>Log out</Button>
}
```

## API Endpoints

### Signup
```bash
POST http://localhost:3001/api/users
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "createdAt": "2024-01-18T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login
```bash
POST http://localhost:3001/api/users/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response: (same as signup)
```

### Get Current User (Protected)
```bash
GET http://localhost:3001/api/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Response:
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "createdAt": "2024-01-18T...",
    "updatedAt": "2024-01-18T..."
  }
}
```

## Error Handling

The `fetchWithAuth` helper automatically:
- Includes the JWT token in the Authorization header
- Logs out the user if a 401 (Unauthorized) response is received
- Redirects to login page on authentication failure

Manual error handling:
```typescript
try {
  const response = await fetchWithAuth(`${API_URL}/api/users/me`)
  
  if (!response.ok) {
    const error = await response.json()
    console.error('API Error:', error.error)
    return
  }
  
  const data = await response.json()
  // Handle success
} catch (error) {
  console.error('Network error:', error)
}
```

## Security Notes

- JWT tokens are stored in localStorage
- Tokens expire after 7 days (configured in backend)
- Passwords must be at least 6 characters
- All passwords are hashed with bcrypt on the backend
- Passwords are never exposed in API responses
- Auth middleware automatically excludes password field from queries

## Testing the Auth Flow

1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `cd frontend && npm run dev`
3. Navigate to `http://localhost:3000/auth`
4. Create an account with email and password
5. You'll be automatically logged in and redirected to `/dashboard`
6. Token is stored in localStorage for future requests

