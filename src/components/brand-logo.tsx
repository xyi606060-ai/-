'use client';

/** 品牌 Logo：抽象"一来一往"对话呼应收敛图形 + 一颗光点 */
export function LogoMark({ className = 'size-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="接话搭子">
      <defs>
        <linearGradient id="ally-grad" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--color-love)" />
        </linearGradient>
      </defs>
      {/* 左：你的一句（实心对话气泡） */}
      <path
        d="M18 16a8 8 0 0 0-8 8v14a8 8 0 0 0 8 8h3l6 6v-6h2l-2-6"
        fill="var(--primary)"
        opacity="0.85"
      />
      {/* 右：TA 的一句（描边对话气泡，呼应） */}
      <path
        d="M46 48a8 8 0 0 0 8-8V26a8 8 0 0 0-8-8"
        fill="none"
        stroke="var(--color-love)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* 中间：一颗光点（连接/心动） */}
      <circle cx="32" cy="33" r="4.5" fill="url(#ally-grad)" />
    </svg>
  );
}

/** 图标 + 文字组合版 */
export function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const mark = size === 'lg' ? 'size-12' : size === 'sm' ? 'size-8' : 'size-10';
  const title = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';
  const sub = size === 'lg' ? 'text-xs' : size === 'sm' ? 'text-[10px]' : 'text-[11px]';
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className={mark} />
      <div className="leading-none">
        <div className={`${title} font-bold tracking-tight text-foreground`}>接话搭子</div>
        <div className={`${sub} mt-1 text-muted-foreground`}>你的聊天军师</div>
      </div>
    </div>
  );
}