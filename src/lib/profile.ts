'use client';

/**
 * 用户名（账号身份）数据层。
 *
 * 高内聚：这里只处理「用户名」这一件事，与业务数据（user_data）解耦。
 * 用户名存在 Supabase 的 profiles 表：user_id 主键（= auth.uid()），
 * username 带 lower() 唯一索引，保证全局不重名。
 * RLS 兜底：本人只能读写自己的那一行。
 */

import { supabase } from '@/lib/supabase';

/** 用户名是否已被占用（注册/改名前查重，未登录也能调用） */
export async function isUsernameTaken(username: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('username_taken', {
    p_username: username,
  });
  // 查重失败时不拦截：宁可放行也不把注册/改名锁死
  if (error) return false;
  return Boolean(data);
}

/** 注册成功后把用户名认领到 profiles（RLS 允许本人 insert） */
export async function claimUsername(username: string): Promise<boolean> {
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, username });
  return !error;
}

/** 读取当前登录用户的用户名（profiles 优先） */
export async function getUsername(): Promise<string | null> {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { username: string }).username;
}

/** 修改用户名（RLS 允许本人 update；唯一约束在数据库兜底） */
export async function renameUsername(username: string): Promise<boolean> {
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('user_id', user.id);
  return !error;
}