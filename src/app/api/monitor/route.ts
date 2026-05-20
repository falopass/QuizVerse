import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      message?: string;
      path?: string;
      source?: string;
      metadata?: Record<string, unknown>;
    };

    if (!payload.message) {
      return NextResponse.json({ error: 'Missing error message' }, { status: 400 });
    }

    console.error(
      JSON.stringify({
        channel: 'monitor',
        at: new Date().toISOString(),
        ...payload,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('monitor-route-failed', error);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
