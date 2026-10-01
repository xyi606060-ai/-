'use client';

/**
 * 「恋爱笔记」博客数据层。
 *
 * 高内聚：这里只处理博客文章这一件事，和业务数据（user_data / contacts）解耦。
 *
 * 表结构（blog_posts）：
 *   id / user_id(=auth.uid()) / title / content(富文本 HTML) / created_at
 * 安全底线：表开 RLS，公开可读，只有本人能写、改、删自己的文章。
 *
 * 作者名「实时跟随用户名」：blog_posts 不冗余存作者名，
 * 展示时按 user_id join 到 profiles 表取当前 username（profiles 已公开读）。
 */

import { supabase } from '@/lib/supabase';

export interface BlogPostMeta {
  id: string;
  title: string;
  created_at: string;
  /** 实时跟随用户名的作者名 */
  author: string;
}

export interface BlogPost extends BlogPostMeta {
  content: string;
  user_id: string;
}

interface PostRow {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  user_id: string;
}

interface ProfileRow {
  user_id: string;
  username: string | null;
}

/** 按 user_id 批量取当前用户名，构建映射（实时跟随改名） */
async function usernamesOf(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase || userIds.length === 0) return map;
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username')
    .in('user_id', userIds);
  if (error) return map;
  for (const row of (data ?? []) as ProfileRow[]) {
    if (row.username) map.set(row.user_id, row.username);
  }
  return map;
}

function metaFrom(post: PostRow, author: string): BlogPostMeta {
  return { id: post.id, title: post.title, created_at: post.created_at, author };
}

/** 文章列表（公开读，按时间倒序） */
export async function listPosts(): Promise<BlogPostMeta[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, title, content, created_at, user_id')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const posts = data as PostRow[];
  const map = await usernamesOf(posts.map((p) => p.user_id));
  return posts.map((p) => metaFrom(p, map.get(p.user_id) ?? '佚名'));
}

/** 单篇详情（公开读） */
export async function getPost(id: string): Promise<BlogPost | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, title, content, created_at, user_id')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const post = data as PostRow;
  const map = await usernamesOf([post.user_id]);
  return {
    ...metaFrom(post, map.get(post.user_id) ?? '佚名'),
    content: post.content ?? '',
    user_id: post.user_id,
  };
}

/** 写新文章（RLS 限定本人 user_id），成功返回文章 id */
export async function createPost(input: {
  title: string;
  content: string;
}): Promise<string | null> {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({ title: input.title, content: input.content, user_id: user.id })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** 更新自己的文章（RLS 限定本人） */
export async function updatePost(
  id: string,
  input: { title: string; content: string },
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('blog_posts')
    .update({ title: input.title, content: input.content })
    .eq('id', id);
  return !error;
}

/** 删除自己的文章（RLS 限定本人） */
export async function deletePost(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  return !error;
}

/** 把时间戳格式化成「2026年9月30日」的中文日期 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}