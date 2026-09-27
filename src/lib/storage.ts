'use client';

export type Gender = 'male' | 'female' | 'unknown';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface Contact {
  id: string;
  name: string;
  gender: Gender;
  stage: string;
  /** 多轮对话上下文（assistant=建议回复，user=对方说的） */
  messages: ChatMsg[];
  /** 单次生成的历史记录 */
  records: { time: number; transcript: string; candidates: { text: string; tone: string }[] }[];
  createdAt: number;
  updatedAt: number;
}

export interface Usage {
  count: number;
  resetAt: number;
}

const CONTACTS_KEY = 'ally_contacts_v1';
const USAGE_KEY = 'ally_usage_v1';
const GENDER_KEY = 'ally_gender_v1';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
const FREE_LIMIT = 5;

function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeWrite(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/* ---------- 全局性别 ---------- */
export function getGender(): { your: Gender; ta: Gender } {
  const raw = safeRead(GENDER_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as { your: Gender; ta: Gender };
    } catch {
      /* ignore */
    }
  }
  return { your: 'male', ta: 'female' };
}
export function saveGender(g: { your: Gender; ta: Gender }): void {
  safeWrite(GENDER_KEY, JSON.stringify(g));
}
/** 是否已初始化过性别选择 */
export function hasGender(): boolean {
  return safeRead(GENDER_KEY) !== null;
}

/* ---------- 人物（Contact） ---------- */
export function getContacts(): Contact[] {
  const raw = safeRead(CONTACTS_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as Contact[];
    const now = Date.now();
    return list
      .filter((c) => now - c.updatedAt < RETENTION_MS)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function getContact(id: string): Contact | undefined {
  return getContacts().find((c) => c.id === id);
}

function persistContacts(list: Contact[]): void {
  safeWrite(CONTACTS_KEY, JSON.stringify(list));
}

export function upsertContact(contact: Contact): void {
  const list = getContacts();
  const idx = list.findIndex((c) => c.id === contact.id);
  if (idx >= 0) list[idx] = contact;
  else list.unshift(contact);
  persistContacts(list);
}

export function removeContact(id: string): void {
  persistContacts(getContacts().filter((c) => c.id !== id));
}

/* ---------- 免费试用计数 ---------- */
export function leftQuota(): { used: number; left: number; exhausted: boolean } {
  const raw = safeRead(USAGE_KEY);
  let count = 0;
  if (raw) {
    try {
      const u = JSON.parse(raw) as Usage;
      if (Date.now() < u.resetAt) count = u.count;
    } catch {
      /* ignore */
    }
  }
  return {
    used: count,
    left: Math.max(0, FREE_LIMIT - count),
    exhausted: count >= FREE_LIMIT,
  };
}
export function consumeUsage(): { left: number; exhausted: boolean } {
  const used = leftQuota().used;
  const count = used + 1;
  safeWrite(USAGE_KEY, JSON.stringify({ count, resetAt: Date.now() + RETENTION_MS }));
  return {
    left: Math.max(0, FREE_LIMIT - count),
    exhausted: count >= FREE_LIMIT,
  };
}

export function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}