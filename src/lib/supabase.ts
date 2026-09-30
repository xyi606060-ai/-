'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Supabase 浏览器客户端。
 * 使用公开的 anon key，数据安全由 Supabase 控制台的 RLS 策略保证：
 * 每张表都开启 RLS，用户只能读写 auth.uid() 属于自己的行。
 * 环境变量缺失时为 null（登录页会给出提示）。
 */
export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
