/**
 * 敏感内容检测（规则关键词拦截）
 *
 * 定位：拦住涉黄 / 暴露 / 引战 / 代聊/外发 / 低俗 等不当表述。
 * 用快而粗的关键词闸做第一道拦截；需要更准时可再叠加 LLM 二次校验。
 */

const BLOCK_KEYWORDS: string[] = [
  // 涉黄 / 低俗
  '上床', '做爱', '一夜情', '约炮', '裸', '骚', '鸡巴', '操你', '草你', '脏话',
  '打炮', '口交', '嫖', '黄色', 'av', '三级片',
  // 暴露 / 分成
  '给钱就', '转账给', '打赏我', '发红包就', '包养',
  // 引战 / 辱骂
  '你妈', '去死', '废物', '垃圾男', '舔狗滚', '傻逼', '脑残', '贱',
  // 代聊 / 外发工具暗示
  '复制这条', '直接发给她', '替我发', '你去发给', '帮你撩',
];

/** 命中即 true（第一道闸） */
export function hasFlag(text: string): boolean {
  if (!text) return true;
  const t = String(text).toLowerCase();
  return BLOCK_KEYWORDS.some((k) => t.includes(k.toLowerCase()));
}

/** 返回具体命中的关键词（供调试/日志） */
export function flagHits(text: string): string[] {
  if (!text) return [];
  const t = String(text).toLowerCase();
  return BLOCK_KEYWORDS.filter((k) => t.includes(k.toLowerCase()));
}

export interface SafetyCheck {
  pass: boolean;
  reason?: string;
  hits?: string[];
}

/**
 * M1 检查入口：命中任一闸即驳回。
 * text 为空视为不安全（要求生成内容）。
 */
export function checkSafety(text: string | null | undefined): SafetyCheck {
  if (!text || !text.trim()) {
    return { pass: false, reason: 'empty', hits: [] };
  }
  const hits = flagHits(text);
  if (hits.length > 0) {
    return { pass: false, reason: 'blocked-keyword', hits };
  }
  return { pass: true, hits: [] };
}