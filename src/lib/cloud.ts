'use client';

/**
 * 云端同步：把本地的性别偏好、人物档案、试用次数同步到 Supabase。
 *
 * 表结构（user_data）：每个用户一行，user_id 为主键。
 * 安全底线：该表开启 RLS，策略限定 user_id = auth.uid()，
 * 任何人只能读写自己的那一行。
 */

import { supabase } from '@/lib/supabase';
import {
  addStorageListener,
  getContacts,
  getGender,
  leftQuota,
  restoreContacts,
  restoreGender,
  restoreUsage,
  type Contact,
  type Gender,
  type Usage,
} from '@/lib/storage';

interface UserDataRow {
  user_id: string;
  gender: { your: Gender; ta: Gender } | null;
  contacts: Contact[] | null;
  usage: Usage | null;
  updated_at: string;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

/** 把当前本地数据整体写入云端（该用户唯一的一行） */
async function pushCloud(): Promise<void> {
  if (!supabase || syncing) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const quota = leftQuota();
  syncing = true;
  try {
    await supabase.from('user_data').upsert(
      {
        user_id: user.id,
        gender: getGender(),
        contacts: getContacts(),
        usage: { count: quota.used, resetAt: Date.now() + 30 * 24 * 60 * 60 * 1000 },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  } catch {
    /* 网络波动时静默失败，本地数据不受影响，下次变更会再同步 */
  } finally {
    syncing = false;
  }
}

/** 防抖：本地数据一变，1 秒后统一推一次云端 */
function schedulePush(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void pushCloud();
  }, 1000);
}

/** 登录成功后：从云端拉回该用户的数据，覆盖本地 */
export async function loadCloud(): Promise<void> {
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !data) return;

  const row = data as UserDataRow;
  if (row.gender) restoreGender(row.gender);
  if (Array.isArray(row.contacts)) restoreContacts(row.contacts);
  if (row.usage && typeof row.usage.count === 'number') restoreUsage(row.usage);
}

/** 启动同步：登录后调用一次。先拉云端，再监听本地变更自动推送 */
let syncStarted = false;
export function startCloudSync(): void {
  if (!supabase || syncStarted) return;
  syncStarted = true;
  void loadCloud();
  addStorageListener({
    onGender: () => schedulePush(),
    onContacts: () => schedulePush(),
    onUsage: () => schedulePush(),
  });
}
