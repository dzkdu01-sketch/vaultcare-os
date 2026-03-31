# Vaultcare OS — 设计系统 (Design System)

> 生成日期：2026-03-09
> 基于：ui-ux-pro-max skill + 项目业务特征
> 技术栈：React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui
> 适用范围：一期全部 9 个页面（页面 1-8 + S1）

---

## 1. 设计风格：Clean Minimalism

| 项目 | 决策 | 理由 |
|---|---|---|
| 主风格 | Clean Minimalism | 业务中台需要数据密度高、视觉干净、操作高效 |
| 辅助风格 | Flat Design + 微妙阴影 | 卡片和面板用轻阴影区分层级，不用重装饰 |
| 避免 | Glassmorphism、Brutalism、Neumorphism | 业务系统不适合强视觉风格，会干扰操作效率 |

### 设计原则

1. **数据优先** — 页面核心是数据，不是装饰
2. **状态可见** — 商品/订单/发布状态必须一眼可辨
3. **操作高效** — 常用操作不超过 2 次点击
4. **一致性** — 所有页面共享同一套视觉语言
5. **留白充分** — 信息密集时靠留白而非分割线区分区域

---

## 2. 色彩系统

### 2.1 主色（Primary）

继承前版本品牌色，使用 Violet 紫色系：

| 用途 | Token | Tailwind Class | Hex |
|---|---|---|---|
| 主色 | `primary` | `violet-600` | `#7c3aed` |
| 主色悬停 | `primary-hover` | `violet-700` | `#6d28d9` |
| 主色浅底 | `primary-light` | `violet-50` | `#f5f3ff` |
| 主色文字 | `primary-foreground` | `white` | `#ffffff` |
| 侧边栏激活 | `sidebar-active` | `violet-600` | `#7c3aed` |

### 2.2 中性色（Neutral）

使用 Slate 灰色系，专业且不偏暖偏冷：

| 用途 | Token | Tailwind Class | Hex |
|---|---|---|---|
| 页面背景 | `background` | `slate-50` | `#f8fafc` |
| 卡片背景 | `card` | `white` | `#ffffff` |
| 侧边栏背景 | `sidebar` | `white → slate-50` | 渐变 |
| 主文字 | `foreground` | `slate-900` | `#0f172a` |
| 次要文字 | `muted-foreground` | `slate-500` | `#64748b` |
| 辅助文字 | `subtle` | `slate-400` | `#94a3b8` |
| 边框 | `border` | `slate-200` | `#e2e8f0` |
| 分割线 | `separator` | `slate-100` | `#f1f5f9` |
| 输入框边框 | `input-border` | `slate-300` | `#cbd5e1` |

### 2.3 语义色（Semantic）

业务中台的状态非常多，语义色是核心：

| 用途 | Token | Tailwind Class | Hex | 适用场景 |
|---|---|---|---|---|
| 成功 | `success` | `emerald-500` | `#10b981` | 已发布、已签收、已关闭 |
| 成功浅底 | `success-light` | `emerald-50` | `#ecfdf5` | 成功状态 Badge 背景 |
| 警告 | `warning` | `amber-500` | `#f59e0b` | 待审核、待交接、挂起 |
| 警告浅底 | `warning-light` | `amber-50` | `#fffbeb` | 警告状态 Badge 背景 |
| 错误 | `destructive` | `red-500` | `#ef4444` | 发布失败、异常、拒收 |
| 错误浅底 | `destructive-light` | `red-50` | `#fef2f2` | 错误状态 Badge 背景 |
| 信息 | `info` | `blue-500` | `#3b82f6` | 草稿、处理中、发布中 |
| 信息浅底 | `info-light` | `blue-50` | `#eff6ff` | 信息状态 Badge 背景 |

### 2.4 状态色映射

这是本项目最关键的色彩规则——每个业务状态对应一个固定颜色：

#### 商品状态

| 状态 | 编码 | 颜色 | Badge 样式 |
|---|---|---|---|
| 待入池 | `draft` | `slate` | `bg-slate-100 text-slate-600` |
| 已入池 | `pooled` | `blue` | `bg-blue-50 text-blue-600` |
| 身份已确认 | `identified` | `blue` | `bg-blue-50 text-blue-700` |
| 内容已整理 | `content_ready` | `amber` | `bg-amber-50 text-amber-700` |
| 素材已确认 | `asset_ready` | `violet` | `bg-violet-50 text-violet-700` |
| 可分销 | `distributable` | `emerald` | `bg-emerald-50 text-emerald-700` |
| 已挂起 | `suspended` | `red` | `bg-red-50 text-red-600` |

#### 订单状态

| 状态 | 编码 | 颜色 | Badge 样式 |
|---|---|---|---|
| 草稿 | `draft` | `slate` | `bg-slate-100 text-slate-600` |
| 待审核 | `pending_review` | `amber` | `bg-amber-50 text-amber-700` |
| 审核中 | `reviewing` | `blue` | `bg-blue-50 text-blue-700` |
| 待交接 | `pending_handover` | `amber` | `bg-amber-50 text-amber-600` |
| 已交接 | `handed_over` | `violet` | `bg-violet-50 text-violet-700` |
| 已签收 | `delivered` | `emerald` | `bg-emerald-50 text-emerald-700` |
| 待结算确认 | `pending_settlement` | `amber` | `bg-amber-50 text-amber-700` |
| 已关闭 | `closed` | `slate` | `bg-slate-100 text-slate-500` |
| 异常 | `exception` | `red` | `bg-red-50 text-red-700` |
| 已拒收 | `rejected` | `red` | `bg-red-50 text-red-600` |
| 已驳回 | `returned` | `orange` | `bg-orange-50 text-orange-700` |

#### 发布关系状态

| 状态 | 编码 | 颜色 | Badge 样式 |
|---|---|---|---|
| 已选品 | `selected` | `blue` | `bg-blue-50 text-blue-600` |
| 待发布 | `pending_publish` | `amber` | `bg-amber-50 text-amber-700` |
| 发布中 | `publishing` | `blue` | `bg-blue-50 text-blue-700` |
| 已发布 | `published` | `emerald` | `bg-emerald-50 text-emerald-700` |
| 发布失败 | `publish_failed` | `red` | `bg-red-50 text-red-700` |
| 已撤销 | `revoked` | `slate` | `bg-slate-100 text-slate-500` |

---

## 3. 字体系统

| 用途 | 字体 | 备选 | 说明 |
|---|---|---|---|
| 全局 | Inter | -apple-system, 'PingFang SC', sans-serif | SaaS 标配，数字渲染清晰 |
| 代码/编号 | JetBrains Mono | 'Fira Code', monospace | 商品编码、订单号等 |

### 字号规范

| Token | 大小 | 行高 | 用途 |
|---|---|---|---|
| `text-xs` | 12px | 1.5 | 辅助标签、时间戳 |
| `text-sm` | 14px | 1.5 | 表格内容、次要信息 |
| `text-base` | 16px | 1.5 | 正文、表单标签 |
| `text-lg` | 18px | 1.75 | 卡片标题 |
| `text-xl` | 20px | 1.75 | 区域标题 |
| `text-2xl` | 24px | 1.33 | 页面标题 |
| `text-3xl` | 30px | 1.33 | 数据大数字（看板） |

### 字重规范

| Token | 字重 | 用途 |
|---|---|---|
| `font-normal` | 400 | 正文 |
| `font-medium` | 500 | 表格表头、标签、导航项 |
| `font-semibold` | 600 | 卡片标题、按钮 |
| `font-bold` | 700 | 页面标题、数据大数字 |

---

## 4. 间距与布局

### 4.1 页面布局

```
┌──────────────────────────────────────────────┐
│ Sidebar (w-64)  │  Main Content Area         │
│                 │                             │
│  Logo           │  Page Title                 │
│  Nav Items      │  ┌─────────────────────┐   │
│                 │  │ Content Cards       │   │
│                 │  │                     │   │
│                 │  └─────────────────────┘   │
│                 │                             │
│  Logout         │                             │
└──────────────────────────────────────────────┘
```

| 区域 | 规格 |
|---|---|
| 侧边栏宽度 | `w-64`（256px） |
| 主内容区内边距 | `p-6 md:p-8 lg:p-10` |
| 卡片间距 | `gap-6` |
| 卡片内边距 | `p-6` |
| 表格行高 | `h-12`（48px） |

### 4.2 间距规范

| Token | 值 | 用途 |
|---|---|---|
| `space-1` | 4px | 图标与文字间距 |
| `space-2` | 8px | 紧凑元素间距 |
| `space-3` | 12px | 表单字段间距 |
| `space-4` | 16px | 卡片内元素间距 |
| `space-6` | 24px | 区域间距 |
| `space-8` | 32px | 大区域间距 |

### 4.3 圆角规范

| Token | 值 | 用途 |
|---|---|---|
| `rounded-md` | 6px | 按钮、输入框 |
| `rounded-lg` | 8px | 卡片、下拉菜单 |
| `rounded-xl` | 12px | 侧边栏导航项、大卡片 |
| `rounded-full` | 9999px | 头像、Badge |

### 4.4 阴影规范

| Token | 用途 |
|---|---|
| `shadow-none` | 默认状态 |
| `shadow-sm` | 卡片默认 |
| `shadow-md` | 卡片悬停、下拉菜单 |
| `shadow-lg` | 弹窗、抽屉 |

---

## 5. 组件规范

### 5.1 按钮

| 变体 | 样式 | 用途 |
|---|---|---|
| Primary | `bg-violet-600 text-white hover:bg-violet-700` | 主操作（保存、提交、发布） |
| Secondary | `bg-slate-100 text-slate-700 hover:bg-slate-200` | 次要操作（取消、返回） |
| Destructive | `bg-red-500 text-white hover:bg-red-600` | 危险操作（删除） |
| Ghost | `hover:bg-slate-100 text-slate-700` | 工具栏按钮 |
| Outline | `border border-slate-300 hover:bg-slate-50` | 辅助操作 |

规则：
- 所有按钮必须有 `cursor-pointer`
- 异步操作时禁用按钮并显示 loading
- 按钮最小高度 36px，触摸目标最小 44x44px
- 过渡动画 `transition-colors duration-200`

### 5.2 状态 Badge

```tsx
// 统一 Badge 组件接口
<StatusBadge status="distributable" />
<StatusBadge status="pending_review" />
<StatusBadge status="exception" />
```

规则：
- 使用 §2.4 中定义的状态色映射
- Badge 内文字使用 `text-xs font-medium`
- 内边距 `px-2.5 py-0.5`
- 圆角 `rounded-full`

### 5.3 数据表格

| 元素 | 样式 |
|---|---|
| 表头 | `bg-slate-50 text-slate-500 text-xs font-medium uppercase tracking-wider` |
| 行 | `border-b border-slate-100 hover:bg-slate-50` |
| 单元格 | `px-4 py-3 text-sm` |
| 编码/ID | `font-mono text-sm text-slate-600` |
| 操作列 | 右对齐，使用 Ghost 按钮或图标按钮 |

规则：
- 表格必须支持排序和筛选
- 空状态显示插图 + 文字提示
- 加载状态使用 Skeleton 占位
- 行点击使用 `cursor-pointer`（如果可点击）

### 5.4 表单

| 元素 | 样式 |
|---|---|
| Label | `text-sm font-medium text-slate-700` |
| Input | `border-slate-300 focus:border-violet-500 focus:ring-violet-500/20 rounded-md` |
| 必填标记 | `text-red-500 ml-0.5` 显示 `*` |
| 错误信息 | `text-sm text-red-500 mt-1` |
| 帮助文字 | `text-sm text-slate-400 mt-1` |

规则：
- 每个 input 必须有 label（无障碍）
- 错误信息显示在字段下方
- 表单分组使用卡片或分割线
- 移动端 input 字号不小于 16px

### 5.5 卡片

```
┌─────────────────────────────┐
│  Card Title          Action │  ← header: flex justify-between
│─────────────────────────────│  ← separator (可选)
│                             │
│  Content                    │  ← body: p-6
│                             │
└─────────────────────────────┘
```

样式：`bg-white rounded-lg shadow-sm border border-slate-200`

### 5.6 侧边栏导航

| 状态 | 样式 |
|---|---|
| 默认 | `text-slate-700 hover:bg-slate-100 hover:text-slate-900` |
| 激活 | `bg-violet-600 text-white shadow-md shadow-violet-600/20` |
| 图标 | `h-5 w-5 flex-shrink-0` |
| 间距 | `px-4 py-3 rounded-xl` |

### 5.7 弹窗与抽屉

| 类型 | 用途 | 宽度 |
|---|---|---|
| Dialog | 确认操作、简单表单 | `max-w-md` |
| Sheet/Drawer | 详情编辑、复杂表单 | `w-[600px]` 或 `w-[800px]` |
| 全屏 | 商品详情编辑 | 全屏或 `max-w-5xl` |

规则：
- 弹窗背景遮罩 `bg-black/40 backdrop-blur-sm`
- 关闭按钮在右上角
- 支持 ESC 键关闭

---

## 6. 图标规范

| 项目 | 规范 |
|---|---|
| 图标库 | Lucide React（已在前版本使用） |
| 默认大小 | `h-5 w-5`（20px） |
| 小图标 | `h-4 w-4`（16px） |
| 大图标 | `h-6 w-6`（24px） |
| 颜色 | 继承父元素文字颜色 |

规则：
- 禁止使用 emoji 作为图标
- 图标按钮必须有 `aria-label`
- 图标与文字间距 `gap-2` 或 `gap-3`

---

## 7. 响应式断点

| 断点 | 宽度 | 布局变化 |
|---|---|---|
| 默认 | < 768px | 侧边栏隐藏，顶部汉堡菜单 |
| `md` | ≥ 768px | 侧边栏显示，双栏布局 |
| `lg` | ≥ 1024px | 内容区加宽 |
| `xl` | ≥ 1280px | 最大内容宽度 |

---

## 8. 动效规范

| 场景 | 时长 | 缓动 |
|---|---|---|
| 按钮悬停 | 200ms | `ease-in-out` |
| 下拉展开 | 200ms | `ease-out` |
| 弹窗出现 | 300ms | `ease-out` |
| 侧边栏滑入 | 300ms | `ease-in-out` |
| 页面切换 | 无动画 | — |

规则：
- 使用 `transform` 和 `opacity`，不用 `width`/`height` 做动画
- 尊重 `prefers-reduced-motion`
- 加载状态使用 Skeleton，不用 Spinner（除非操作型按钮）

---

## 9. 无障碍（Accessibility）

| 规则 | 要求 |
|---|---|
| 文字对比度 | 正文 ≥ 4.5:1，大标题 ≥ 3:1 |
| 焦点状态 | 所有交互元素必须有可见焦点环 |
| 键盘导航 | Tab 顺序与视觉顺序一致 |
| 表单标签 | 每个 input 必须关联 label |
| 图标按钮 | 必须有 `aria-label` |
| 颜色不是唯一指示 | 状态除颜色外还需文字或图标辅助 |

---

## 10. 反模式（Anti-Patterns）

以下做法在本项目中禁止：

| 禁止 | 原因 | 替代方案 |
|---|---|---|
| 用 emoji 做图标 | 不专业，渲染不一致 | 用 Lucide 图标 |
| 用 scale 做悬停效果 | 会导致布局抖动 | 用 color/shadow 变化 |
| 浅色文字在浅色背景 | 对比度不足 | 正文用 slate-900，次要用 slate-500 |
| 混用不同圆角 | 视觉不一致 | 统一用 §4.3 规范 |
| 表格无空状态 | 用户困惑 | 显示空状态插图 + 提示 |
| 按钮无 loading | 用户重复点击 | 异步操作显示 loading |
| 弹窗套弹窗 | 体验差 | 用抽屉或页面跳转 |

---

## 11. 交付前检查清单

### 视觉质量
- [ ] 无 emoji 图标
- [ ] 图标来自 Lucide，大小一致
- [ ] 悬停状态不导致布局抖动
- [ ] 使用设计系统定义的颜色 Token

### 交互
- [ ] 所有可点击元素有 `cursor-pointer`
- [ ] 悬停有视觉反馈
- [ ] 过渡动画 150-300ms
- [ ] 焦点状态可见

### 响应式
- [ ] 375px / 768px / 1024px / 1440px 四个断点测试
- [ ] 移动端无水平滚动
- [ ] 侧边栏在移动端正确收起

### 无障碍
- [ ] 图片有 alt 文字
- [ ] 表单有 label
- [ ] 颜色不是唯一指示
- [ ] 尊重 `prefers-reduced-motion`
