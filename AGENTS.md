# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 产品上下文：接话搭子

线上交友话术助手（手机优先的响应式 Web，未来套壳小程序）。

- 定位：帮用户在线上交友时解决「不会开场 / 不会接话」问题。
- 核心能力：
  - 上传聊天截图（多模态识别）或粘贴文字 → 单次生成 3 条候选回复。
  - 多轮聊接模式：流式（SSE）一句句帮你接下去，推向关系升温。
  - 免费试用 5 次，超出引导解锁（收款模块 M4 未做，仅计数）。
- 价值标尺：自然不作做 / 高回复率 / 推进关系 / 安全不油腻（写死在系统提示词）。

### 关键文件
- `src/lib/chatter.ts`：LLM 单次生成 + 流式对话；含候选 JSON 的容错解析（模型偶发二次编码 JSON，用 `locateResult` 递归抽取）。
- `src/lib/storage.ts`：试用计数 + 历史记录（localStorage，30 天符号化留存）。
- `src/lib/image.ts`：截图前端压缩转 base64。
- `src/app/api/suggest/route.ts`：POST 单次生成。
- `src/app/api/talk/route.ts`：POST 流式（SSE）多轮接话。
- `src/components/dating-app.tsx`：主应用壳（底部 Tab：生成/对话/历史/我的）。
- `src/lib/clipboard.ts`：复制文本（跨域安全降级）。
- `DESIGN.md`：温暖蜜桃珊瑚主题设计规范。
- `src/lib/emotion.ts`：哄哄情绪规则引擎（`computeDelta` 按 动作类型×场景期望 算增减；`GIRL_PHRASES` 四女友固定话术）。
- `src/lib/coquette.ts`：哄哄 LLM 人设层（`GIRL_TYPES` 四性格、`generateScene` 场景、`generateReply` 台词、`generateOptions` 动态话术）。
- `src/lib/safety.ts`：敏感内容关键词闸（涉黄/暴漏/引战/代聊）。
- `src/lib/gfStorage.ts`：对局记录/女友偏好（localStorage）。
- `src/app/api/hong/scene/route.ts`、`/api/hong/options/route.ts`（动态话术）、`/api/hong/talk/route.ts`（SSE）。
- `src/app/hong/page.tsx`：哄哄游戏页面（选女友/游戏台/结算）。

## 产品 B：哄哄模拟器（独立产品，路由 `/hong`）

- 定位：AI 扮演生气女友、玩家靠读心术把她哄好的纯娱乐小游戏（移动端优先）。
- 玩法：情绪 10→2 赢，冲过 12 或机会用尽输；4 位女友可选（温柔玉女/软萌萝莉/高冷御姐/元气活力），话术面板选 1–3 句发出，多轮拉扯会翻旧账提难度。
- 核心原则：**情绪数值由规则引擎硬编码（AI 不碰数值）**，AI 只生成台词/语气/表演。
- 关联需求文档：`docs/HONG_REQUIREMENTS.md`。

### 关键文件
- `src/lib/emotion.ts`：情绪规则引擎（`computeDelta` 按 动作类型×场景期望 算增减；`PHRASES` 话术库）。
- `src/lib/coquette.ts`：LLM 人设层（`GIRL_TYPES` 四性格、`generateScene` 生成场景+线索、`generateReply` 生成应景台词）。
- `src/lib/safety.ts`：敏感内容关键词闸（涉黄/暴漏/引战/代聊）。
- `src/lib/gfStorage.ts`：对局记录/女友偏好（localStorage）。
- `src/app/api/hong/scene/route.ts`：POST 生成生气场景+开场台词+读心线索（JSON）。
- `src/app/api/hong/talk/route.ts`：POST 接话，SSE 事件流 `text/expr/delta/done`（text=流式台词，expr=表情动作指令，delta=情绪增减+mood）。
- `src/app/hong/page.tsx`：游戏界面（选女友/游戏台/结算三阶段，浏览器 Web Speech 语音）。

### 运行时注意
- `/api/hong/*` 均 `nodejs` runtime + `force-dynamic`；LLM 用 `coze-coding-dev-sdk` + `HeaderUtils.extractForwardHeaders`。
- 规则引擎逻辑集中在 `emotion.ts`，改动分值先看 `docs/HONG_REQUIREMENTS.md` 的 6.4 表。
- M1.5 将接 3D 形象（Three.js/R3F）、M2 接专业 TTS 真人音；当前语音为浏览器 Web Speech。

### 运行时注意事项
- LLM 走 `coze-coding-dev-sdk`，必须 `HeaderUtils.extractForwardHeaders` 转发请求头。
- `route.ts` 为 Node runtime + `dynamic = 'force-dynamic'`。
- 涉及图片多模态时用 `doubao-seed-2-0-pro-260215`（在 `chatter.ts` 的 `CHAT_MODEL` 中）。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**
