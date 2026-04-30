import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
  const body = await request.text();

  const forwardHeaders = new Headers();
  const authorization = request.headers.get('authorization');
  const tenantId = request.headers.get('x-tenant-id');

  if (authorization) {
    forwardHeaders.set('authorization', authorization);
  }
  if (tenantId) {
    forwardHeaders.set('x-tenant-id', tenantId);
  }
  forwardHeaders.set('content-type', 'application/json');

  const response = await fetch(`${backendUrl}/chatbot/ai-chat`, {
    method: 'POST',
    headers: forwardHeaders,
    body,
  });

  const responseBody = await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      'content-type': 'application/json',
    },
  });
}
