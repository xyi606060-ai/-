'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, HeartHandshake, Sparkles, LogOut, CircleUserRound, Pencil } from 'lucide-react';
import { leftQuota, getGender, saveGender, type Gender } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { getUsername, renameUsername, isUsernameTaken } from '@/lib/profile';
import { toast } from 'sonner';

const GENDER_OPTIONS: { value: Gender; label: string; emoji: string }[] = [
  { value: 'male', label: '男', emoji: '👨' },
  { value: 'female', label: '女', emoji: '👩' },
  { value: 'unknown', label: '暂不确定', emoji: '❓' },
];

export function SettingsTab() {
  const [quota, setQuota] = useState<{ used: number; left: number; exhausted: boolean }>({
    used: 0,
    left: 5,
    exhausted: false,
  });
  const [gender, setGender] = useState(getGender());
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    setQuota(leftQuota());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void (async () => {
      // 优先读 profiles 里的用户名（权威来源），拿不到再回退邮箱
      const username = await getUsername();
      if (!mounted) return;
      if (username) {
        setDisplayName(username);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      const meta = user?.user_metadata as { username?: string } | undefined;
      setDisplayName(meta?.username ?? user?.email ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const startEdit = () => {
    setNewName(displayName ?? '');
    setEditing(true);
  };

  const submitRename = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('用户名不能为空');
      return;
    }
    if (name.length > 20) {
      toast.error('用户名最多 20 个字');
      return;
    }
    if (name === displayName) {
      setEditing(false);
      return;
    }
    if (await isUsernameTaken(name)) {
      toast.error('这个用户名已经有人用了，换一个吧');
      return;
    }
    const ok = await renameUsername(name);
    if (ok) {
      setDisplayName(name);
      setEditing(false);
      toast.success('用户名已更新');
    } else {
      toast.error('改名失败，稍后再试');
    }
  };

  const changeGender = (key: 'your' | 'ta', value: Gender) => {
    const next = { ...gender, [key]: value };
    setGender(next);
    saveGender(next);
    toast.success('已保存');
  };

  const logout = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('退出失败，请稍后再试');
      return;
    }
    window.location.reload();
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-4">
      {displayName && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CircleUserRound className="size-6" />
            </div>
            {editing ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="输入新用户名"
                  maxLength={20}
                  className="h-9 rounded-lg bg-muted/40"
                />
                <Button
                  size="sm"
                  onClick={() => void submitRename()}
                  className="h-9 shrink-0 rounded-lg"
                >
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  className="h-9 shrink-0 rounded-lg"
                >
                  取消
                </Button>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground">已登录 · 数据已同步到云端</p>
                </div>
                <Badge variant="secondary">已登录</Badge>
                <button
                  type="button"
                  onClick={startEdit}
                  aria-label="修改用户名"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-sun" />
          <h3 className="text-sm font-semibold">免费额度</h3>
          <Badge variant="secondary" className="ml-auto">
            {quota.exhausted ? '已用完' : `剩 ${quota.left} 次`}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          每位用户可免费生成 {quota.used + quota.left} 次话术。当前已用 {quota.used} 次。
          {quota.exhausted
            ? ' 试用次数已用尽，后续解锁正在开发中，敬请期待。'
            : ' 剩余的免费次数用完即止。'}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <HeartHandshake className="size-4 text-love" />
          <h3 className="text-sm font-semibold">我的性别</h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => changeGender('your', g.value)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                gender.your === g.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40'
              }`}
            >
              {g.emoji} {g.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">用于切换应用的界面配色。</p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-chat-blue-deep" />
          <h3 className="text-sm font-semibold">隐私说明</h3>
        </div>
        <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <li>· 你上传的聊天内容，仅用于本次 AI 生成。</li>
          <li>· 对话历史本地保存，最长 30 天，到期自动清理。</li>
          <li>· 我们不存储社交账号、不对外透露聊天内容。</li>
          <li>· 建议复制话术后先人工润色再发送，效果与分寸由你把握。</li>
        </ul>
      </div>

      {supabase && (
        <Button
          variant="outline"
          onClick={() => void logout()}
          className="w-full gap-2 rounded-2xl text-muted-foreground"
        >
          <LogOut className="size-4" /> 退出登录
        </Button>
      )}
    </div>
  );
}