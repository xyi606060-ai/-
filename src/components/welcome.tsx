'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand-logo';
import { getGender, saveGender, type Gender } from '@/lib/storage';

const SLOGAN = '冷场别慌，接话搭子陪你把每一句聊下去';

const GENDER_OPTIONS: { value: Gender; label: string; emoji: string }[] = [
  { value: 'male', label: '男', emoji: '👨' },
  { value: 'female', label: '女', emoji: '👩' },
  { value: 'unknown', label: '暂不确定', emoji: '❓' },
];

function GenderPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Gender;
  onChange: (g: Gender) => void;
}) {
  return (
    <div className="text-left">
      <div className="mb-2 text-sm font-medium text-foreground">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {GENDER_OPTIONS.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => onChange(g.value)}
            className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-sm transition ${
              value === g.value
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40'
            }`}
          >
            <span className="text-xl leading-none">{g.emoji}</span>
            <span>{g.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface WelcomeProps {
  onContinue: () => void;
}

export function Welcome({ onContinue }: WelcomeProps) {
  const init = getGender();
  const [your, setYour] = useState<Gender>(init.your);
  const [ta, setTa] = useState<Gender>(init.ta);

  const start = () => {
    saveGender({ your, ta });
    onContinue();
  };

  return (
    <div className="ally-fadein mx-auto flex h-full w-full max-w-md flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <LogoMarkFloat />
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">接话搭子</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{SLOGAN}</p>
      </div>

      <div className="space-y-4 px-6 pb-6">
        <div className="rounded-3xl border bg-card p-4 shadow-sm">
          <p className="mb-3 text-xs text-muted-foreground">
            为了让话术更自然、配色更贴心，先简单告诉我们：
          </p>
          <div className="space-y-4">
            <GenderPicker label="你是" value={your} onChange={setYour} />
            <GenderPicker label="TA 是（你正在聊的对象）" value={ta} onChange={setTa} />
          </div>
        </div>
        <Button className="w-full gap-2 rounded-2xl py-6 text-base" onClick={start}>
          开始使用
        </Button>
        <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          AI 话术仅供思路参考，建议人工润色后再发送 · 聊天内容仅用于本次生成
        </p>
      </div>
    </div>
  );
}

function LogoMarkFloat() {
  return (
    <div className="relative flex size-20 items-center justify-center">
      <LogoCore />
      <span className="absolute -inset-2 rounded-full bg-primary/10 blur-xl" />
    </div>
  );
}

function LogoCore() {
  return (
    <svg viewBox="0 0 64 64" className="size-16">
      <defs>
        <linearGradient id="wbrand" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--color-love)" />
        </linearGradient>
      </defs>
      <path d="M18 16a8 8 0 0 0-8 8v14a8 8 0 0 0 8 8h3l6 6v-6h2l-2-6" fill="var(--primary)" opacity="0.85" />
      <path d="M46 48a8 8 0 0 0 8-8V26a8 8 0 0 0-8-8" fill="none" stroke="var(--color-love)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="33" r="4.5" fill="url(#wbrand)" />
    </svg>
  );
}