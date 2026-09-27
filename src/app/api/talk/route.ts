import { NextRequest } from 'next/server';
import { talkStream } from '@/lib/chatter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const stage: string = body.stage ?? '刚认识';
  const transcript: string = body.transcript ?? '';
  const rawHistory: unknown = body.history;
  const history: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(rawHistory)
    ? (rawHistory as Array<{ role?: unknown; content?: unknown }>)
        .filter(
          (m) =>
            m &&
            (typeof m.role === 'string') &&
            typeof m.content === 'string',
        )
        .slice(-10)
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: (m.content as string).trim(),
        }))
    : [];

  if (history.length === 0) {
    history.push({
      role: 'user',
      content: 'TA 说：' + (body.lastUserText ?? '今天干嘛呢'),
    });
  }

  const stream = talkStream(request, {
    stage,
    transcript,
    history,
    yourGender: typeof body.yourGender === 'string' ? body.yourGender : undefined,
    taGender: typeof body.taGender === 'string' ? body.taGender : undefined,
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}