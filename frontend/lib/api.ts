// Centralized API client for backend communication

import { fetchWithAuth } from './auth'
import type {
  BackendConnection,
  ConnectionsListResponse,
  ConnectionResponse,
  ConnectionsQueryParams,
  ApproveConnectionRequest,
  NetworkAnalyticsData,
  NetworkRecommendation,
} from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Helper to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: unknown
    try {
      errorData = await response.json()
    } catch {
      errorData = { message: response.statusText }
    }
    throw new ApiError(
      (errorData as { message?: string })?.message || `Request failed with status ${response.status}`,
      response.status,
      errorData
    )
  }
  return response.json()
}

// ============ CONNECTIONS API ============

/**
 * Get list of connections with optional filtering
 */
export async function getConnections(
  params: ConnectionsQueryParams = {}
): Promise<ConnectionsListResponse> {
  const searchParams = new URLSearchParams()

  if (params.status) searchParams.set('status', params.status)
  if (params.search) searchParams.set('search', params.search)
  if (params.event) searchParams.set('event', params.event)
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.offset) searchParams.set('offset', params.offset.toString())

  const queryString = searchParams.toString()
  const url = `${API_URL}/api/connections${queryString ? `?${queryString}` : ''}`

  const response = await fetchWithAuth(url)
  return handleResponse<ConnectionsListResponse>(response)
}

/**
 * Get draft connections (pending review)
 */
export async function getDraftConnections(): Promise<ConnectionsListResponse> {
  return getConnections({ status: 'draft' })
}

/**
 * Get approved connections
 */
export async function getApprovedConnections(): Promise<ConnectionsListResponse> {
  return getConnections({ status: 'approved' })
}

/**
 * Get a single connection by ID
 */
export async function getConnectionById(id: string): Promise<BackendConnection> {
  const response = await fetchWithAuth(`${API_URL}/api/connections/${id}`)
  // Backend returns connection directly, not wrapped in { connection: ... }
  return handleResponse<BackendConnection>(response)
}

/**
 * Approve a connection (move from draft to approved)
 * Optionally update fields during approval
 */
export async function approveConnection(
  id: string,
  updates?: ApproveConnectionRequest['updates']
): Promise<BackendConnection> {
  const response = await fetchWithAuth(`${API_URL}/api/connections/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ updates }),
  })
  // Backend returns connection directly, not wrapped in { connection: ... }
  return handleResponse<BackendConnection>(response)
}

/**
 * Delete a connection
 */
export async function deleteConnection(id: string): Promise<void> {
  const response = await fetchWithAuth(`${API_URL}/api/connections/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new ApiError('Failed to delete connection', response.status)
  }
}

/**
 * Update follow-up hook completion status
 * NOTE: Backend endpoint for this doesn't exist yet - will return 404
 */
export async function updateFollowUpHook(
  connectionId: string,
  hookIndex: number,
  completed: boolean
): Promise<BackendConnection> {
  const response = await fetchWithAuth(
    `${API_URL}/api/connections/${connectionId}/follow-up/${hookIndex}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }
  )
  // Backend returns connection directly, not wrapped in { connection: ... }
  return handleResponse<BackendConnection>(response)
}

/**
 * Search connections by text query
 */
export async function searchConnections(query: string): Promise<ConnectionsListResponse> {
  return getConnections({ search: query })
}

/**
 * Get connection count by status (for badges)
 */
export async function getConnectionCounts(): Promise<{
  draft: number
  approved: number
  archived: number
  total: number
}> {
  const [draftRes, approvedRes, archivedRes] = await Promise.all([
    getConnections({ status: 'draft', limit: 1 }),
    getConnections({ status: 'approved', limit: 1 }),
    getConnections({ status: 'archived', limit: 1 }),
  ])

  return {
    draft: draftRes.total,
    approved: approvedRes.total,
    archived: archivedRes.total,
    total: draftRes.total + approvedRes.total + archivedRes.total,
  }
}

export async function getNetworkAnalytics(): Promise<NetworkAnalyticsData> {
  const response = await fetchWithAuth(`${API_URL}/api/analytics/network`)
  return handleResponse<NetworkAnalyticsData>(response)
}

export async function getNetworkRecommendations(): Promise<NetworkRecommendation[]> {
  const response = await fetchWithAuth(`${API_URL}/api/analytics/recommendations`, {
    method: 'POST',
  })
  return handleResponse<NetworkRecommendation[]>(response)
}
