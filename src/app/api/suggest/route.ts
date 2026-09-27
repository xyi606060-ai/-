import { NextRequest, NextResponse } from 'next/server';
import { suggest, type SuggestRequest } from '@/lib/chatter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: SuggestRequest = await request.json();
    if ((!body.screenshots || body.screenshots.length === 0) && !body.text?.trim()) {
      return NextResponse.json({ error: '请先上传聊天截图，或粘贴对方的发言' }, { status: 400 });
    }
    if (body.screenshots && body.screenshots.length > 6) {
      return NextResponse.json({ error: '一次最多上传 6 张截图' }, { status: 400 });
    }
    const result = await suggest(request, body);
    return NextResponse.json({ data: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}