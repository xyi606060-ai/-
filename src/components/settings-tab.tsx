'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, HeartHandshake, Sparkles } from 'lucide-react';
import { leftQuota, getGender, saveGender, type Gender } from '@/lib/storage';
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

  useEffect(() => {
    setQuota(leftQuota());
  }, []);

  const changeGender = (key: 'your' | 'ta', value: Gender) => {
    const next = { ...gender, [key]: value };
    setGender(next);
    saveGender(next);
    toast.success('已保存');
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-4">
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
    </div>
  );
}