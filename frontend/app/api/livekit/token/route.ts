import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { roomName, participantName } = await req.json();

    // Get authorization header from request
    const authHeader = req.headers.get('authorization');
    const cookieHeader = req.headers.get('cookie');

    // Call your Express backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    
    // Forward auth headers
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(`${backendUrl}/api/livekit/token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ roomName, participantName }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get token');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching token:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get token' },
      { status: 500 }
    );
  }
}

