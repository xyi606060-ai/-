import { Config, LLMClient, HeaderUtils, type Message } from 'coze-coding-dev-sdk';
import type { NextRequest } from 'next/server';

// 选用多模态旗舰模型：既能读聊天截图，也能生成自然情商话术
export const CHAT_MODEL = 'doubao-seed-2-0-pro-260215';

export interface SuggestRequest {
  /** 用户上传的聊天截图（base64 data URI 数组） */
  screenshots?: string[];
  /** 用户手动粘贴的对方消息（可选） */
  text?: string;
  /** 关系阶段：刚认识 / 聊了几天 / 正在升温 / 快约见面 */
  stage?: string;
  /** 用户自己的性别 */
  yourGender?: string;
  /** 对方（TA）的性别 */
  taGender?: string;
}

export interface SuggestResult {
  stage: string;
  transcript: string;
  candidates: { text: string; tone: string }[];
}

const STAGES = ['刚认识', '聊了几天', '正在升温', '快约见面了'];

/** 用户当前所处关系阶段 */
export function normalizeStage(stage?: string): string {
  if (stage && STAGES.includes(stage)) return stage;
  return '刚认识';
}

/** 把聊天上下文整理成给模型的文本描述（用于多轮对话的固定背景） */
export function buildContext(stage: string, transcript: string): string {
  const parts: string[] = [];
  parts.push(`当前你与对方的关系阶段：${stage}。`);
  if (transcript && transcript.trim()) {
    parts.push(`以下是已确认的聊天内容背景：\n${transcript.trim()}`);
  }
  return parts.join('\n');
}

function createClient(request: NextRequest): LLMClient {
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  return new LLMClient(config, customHeaders);
}

/** 把用户输入（截图+文本）转成多模态内容数组 */
function buildImageContent(request: SuggestRequest): (string | { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' } })[] {
  const parts: (string | { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' } })[] = [];
  if (request.text?.trim()) {
    parts.push({ type: 'text', text: `对方最近的发言（手动输入）：\n${request.text.trim()}` });
  }
  if (request.screenshots && request.screenshots.length > 0) {
    parts.push({ type: 'text', text: `我上传了 ${request.screenshots.length} 张与对方的聊天截图，请按顺序理解全部内容。` });
    request.screenshots.forEach((s) => {
      parts.push({
        type: 'image_url',
        image_url: { url: s, detail: 'high' },
      });
    });
  }
  return parts;
}

/** 根据双方性别生成一句话术风格指引（含防刻板约束） */
function genderGuidance(your?: string, ta?: string): string {
  const y = your === 'female' ? '女生' : your === 'male' ? '男生' : '未知';
  const t = ta === 'female' ? '女生' : ta === 'male' ? '男生' : '未知';
  if (y === '未知' && t === '未知') return '';
  return `说话人背景：你是${y}，对方(TA)是${t}。请根据 TA 的性别，适度调整称呼方式、共同兴趣切入点和语气（例如 TA 为女生时可用更细腻温柔的切入点，TA 为男生时可用更爽朗大方的切入点），但要保持自然与分寸，严禁任何性别刻板印象、油腻或冒犯性表达。`;
}

/**
 * 单次生成：读图理解对话 + 输出 3 条候选回复。
 * 同时返回提取出的可用文字转写（transcript），供多轮模式延续。
 */
export async function suggest(request: NextRequest, body: SuggestRequest): Promise<SuggestResult> {
  const client = createClient(request);
  const stage = normalizeStage(body.stage);
  const genderTip = genderGuidance(body.yourGender, body.taGender);

  const system = `你是「接话搭子」，一位极懂分寸的线上交友聊天军师。你的任务：读取用户与潜在对象的聊天内容，为其生成自然、能推进关系的回复建议。

必须遵守的价值标准（每条候选都要满足）：
1. 自然不作做：像真人随手发出的，绝不暴露"我在用工具""AI 帮我回的"。
2. 高回复率：能让对方愿意继续接话，而不是一句终结。
3. 推进关系：在合适的时机轻轻把关系往前推（调侃、关心、约见），但不过度。
4. 安全不油腻：严禁油腻、冒犯、尬撩、低俗、死缠烂打。保持得体、有趣、有边界感。

当前关系阶段：${stage}。
${genderTip ? genderTip + '\n' : ''}请基于聊天截图/文字，先判断两人关系阶段（若证据不明显则沿用用户所选），再用 JSON 输出：
{"stage":"<判断后的阶段，从[刚认识,聊了几天,正在升温,快约见面了]选>","transcript":"<把截图对话整理成清晰的文字转写，标注说话人，如 我：xxx / TA：xxx>","candidates":[{"text":"<第1条建议回复，1-3句话>","tone":"<这条的调性，如 轻松幽默/真诚关心/试探推进>"},{"text":"<第2条建议回复>","tone":"<调性>"},{"text":"<第3条建议回复>","tone":"<调性>"}]}

要求：candidates 数组必须恰好包含 3 条回复。三条在调性上差异化（如一条轻松、一条走心、一条推进）。
只输出合法 JSON，不要输出任何多余文字、解释或 markdown 代码块。`;

  const userContent = buildImageContent(body);
  const messages: Message[] = [
    { role: 'system', content: system },
    { role: 'user', content: userContent as unknown as string },
  ];

  const resp = await client.invoke(messages, {
    model: CHAT_MODEL,
    temperature: 0.85,
    thinking: 'disabled',
  });

  const raw = resp.content ?? '';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = locateResult(cleaned);
  const resolvedStage = normalizeStage(parsed.stage || body.stage);
  const betterCandidates = extractTextCandidates(cleaned);
  const candidates =
    parsed.candidates && parsed.candidates.length > 0
      ? parsed.candidates
      : betterCandidates.length > 0
        ? betterCandidates.map((t) => ({ text: t, tone: '自然' }))
        : [{ text: parsed.transcript || cleaned, tone: '自然' }];

  return {
    stage: resolvedStage,
    transcript: (parsed.transcript ?? '').trim(),
    candidates: candidates.slice(0, 3),
  };
}

/** 兜底：从含嵌套 JSON 的字符串里用正则抽出所有 "text": "..." 内容，过滤掉文字里的 JSON 项 */
function extractTextCandidates(s: string): string[] {
  const out: string[] = [];
  const re = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null && out.length < 6) {
    const rawText = m[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, ' ')
      .replace(/\\\\/g, '\\')
      .trim();
    if (rawText.length > 2 && !isJsonObject(rawText)) out.push(rawText);
  }
  return out;
}

function isJsonObject(s: string): boolean {
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

/** 从任意字符串中抽取第一个平衡的 JSON 对象（忽略前后包裹的多余文字） */
function extractJsonObject(s: string): string | null {
  let start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}' && --depth === 0) {
      return s.slice(start, i + 1);
    }
  }
  return null;
}

function tryParse(s: string): Record<string, unknown> | null {
  const sub = extractJsonObject(s);
  if (!sub) return null;
  try {
    const v = JSON.parse(sub);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

interface Located {
  stage?: string;
  transcript?: string;
  candidates?: { text: string; tone: string }[];
}

/** 递归在任意嵌套结构里找到格式良好的 candidates，兼容模型偶发的 JSON 二次编码 */
function locateResult(input: string | Record<string, unknown>): Located {
  const node: Record<string, unknown> | null =
    typeof input === 'string' ? tryParse(input) : input;
  if (!node) return {};

  // 当前层就有合格 candidates（text 不是内嵌 JSON）
  if (Array.isArray(node.candidates)) {
    const items = (node.candidates as Array<Record<string, unknown>>)
      .filter(
        (c) => c && typeof c.text === 'string' && c.text.trim() && !isJsonObject(c.text),
      )
      .map((c) => ({
        text: (c.text as string).trim(),
        tone: typeof c.tone === 'string' ? (c.tone as string).trim() : '自然',
      }));
    if (items.length > 0) {
      return {
        stage: typeof node.stage === 'string' ? (node.stage as string) : undefined,
        transcript:
          typeof node.transcript === 'string' ? (node.transcript as string) : undefined,
        candidates: items,
      };
    }
  }

  // 向下钻取：在字符串值或嵌套对象里继续找
  for (const value of Object.values(node)) {
    if (typeof value === 'string') {
      const found = locateResult(value);
      if (found.candidates && found.candidates.length > 0) return found;
    } else if (value && typeof value === 'object') {
      const found = locateResult(value as Record<string, unknown>);
      if (found.candidates && found.candidates.length > 0) return found;
    }
  }
  return {};
}

/**
 * 多轮对话式：根据用户贴入的"对方最新发言"，流式输出"你该说的下一句"。
 * 返回一个 SSE 文本流（chunk.content)。
 */
export function talkStream(
  request: NextRequest,
  opts: {
    stage: string;
    transcript: string;
    yourGender?: string;
    taGender?: string;
    history: { role: 'user' | 'assistant'; content: string }[];
  },
): ReadableStream<Uint8Array> {
  const client = createClient(request);
  const { stage, transcript, history } = opts;
  const genderTip = genderGuidance(opts.yourGender, opts.taGender);

  const context = buildContext(stage, transcript);
  const system = `你是「接话搭子」，一位极懂分寸的线上交友聊天军师。你坐在用户身边当"搭子"，帮他把话说得自然、不油腻。

规则：用户的每条消息 = 对方（TA）对用户说的最新一句话。你的每一条回复 = 建议用户接下来"该对 TA 说什么"。

必须遵守的价值标准：
1. 自然不作做：像真人随手发出，不暴露 AI 痕迹。
2. 高回复率：让 TA 愿意继续接话。
3. 推进关系：在合适时机轻轻推进，不过度。
4. 安全不油腻：严禁油腻、冒犯、尬撩、低俗、死缠烂打。

${genderTip ? genderTip + '\n' : ''}输出要求：
- 直接给出"你应该说的话"，1-3 句，口语化，像是你替用户想好的最合适的回答。
- 语气自然松弛，先接住对方抛的点，再（可选）轻轻留个话头或进一步。
- 不要解释、不要加"你可以说"之类的前缀、不要用引号包裹整句。
- 如果对方明显冷淡/敷衍，建议得体地收住，绝不死缠烂打。

背景信息：\n${context}`;

  const messages: Message[] = [{ role: 'system', content: system }];
  const tail = history.slice(-10);
  for (const m of tail) {
    messages.push({ role: m.role, content: m.content });
  }
  // 保证至少一条 user
  if (!history.some((m) => m.role === 'user')) {
    messages.push({ role: 'user', content: '（我暂时没有更多输入，请先给一句自然的话术开场建议）' });
  }

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.stream(messages, {
          model: CHAT_MODEL,
          temperature: 0.85,
          thinking: 'disabled',
        });
        for await (const chunk of stream) {
          if (chunk && chunk.content) {
            controller.enqueue(encoder.encode(chunk.content.toString()));
          }
        }
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : '生成失败';
        controller.enqueue(encoder.encode(`\n\n【生成中断】${msg}`));
        controller.close();
      }
    },
  });
}