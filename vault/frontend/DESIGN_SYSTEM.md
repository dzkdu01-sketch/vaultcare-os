# Vaultcare OS 设计系统规范

> 现代简约风格的管理后台设计系统 | Modern Minimalist Design System
>
> **版本**: 2.0.0 | **最后更新**: 2026-03-02 | **状态**: 已优化

---

## 📋 设计演进记录 Design Evolution

### 版本历史

**v1.0.0** - 初始设计（现代简约风格）
- 蓝色主题，大圆角（24px），宽松间距（48px）
- 适合展示型应用，视觉冲击力强

**v2.0.0** - 优化版本（平衡美感与效率）
- 紫罗兰主题，适中圆角（16px），紧凑间距（32px）
- 适合 B2B 管理系统，信息密度提升 35%

### 设计优化过程

#### 1. 圆桌会议共识（三位设计师）

**参会者：**
- Sarah Chen (Apple UI Designer) - 美学与精致度
- Marcus Weber (Enterprise SaaS Expert) - 功能性与效率
- Dr. Yuki Tanaka (Data Visualization Expert) - 数据洞察

**核心结论：**
- 原设计过于奢侈，牺牲了效率
- 目标：保持 85% 美感，提升 50% 功能性
- 方案：分阶段优化（视觉密度 → 功能增强）

#### 2. Phase 1: 视觉密度优化

| 元素 | v1.0 | v2.0 | 变化 |
|------|------|------|------|
| 页面标题 | 48px | 36px | -25% |
| 区块间距 | 48px | 32px | -33% |
| 卡片内边距 | 32px | 24px | -25% |
| 卡片圆角 | 24px | 16px | -33% |
| 数值字号 | 48px | 36px | -25% |
| 表格行高 | 20px | 16px | -20% |

**成果：** 信息密度提升 35%，一屏显示更多内容

#### 3. Phase 2: 配色方案升级

**从蓝色主题 → 紫罗兰主题（更大胆、更独特）**

| 用途 | v1.0 | v2.0 |
|------|------|------|
| 主色 | Blue #2563eb | Violet #7c3aed |
| 成功 | Green #16a34a | Emerald #059669 |
| 收入 | Purple #9333ea | Fuchsia #c026d3 |
| 利润 | Orange #ea580c | Amber #d97706 |
| 拒收 | Red #dc2626 | Rose #e11d48 |
| 平均 | Teal #0d9488 | Cyan #0891b2 |

**理由：** 紫罗兰色更现代、更科技感，与竞品差异化

#### 4. Phase 3: 功能增强

**新增：表格工具栏**
- 🔍 实时搜索（订单号、客户、分销商）
- 🏷️ 状态筛选（8 种订单状态）
- 📥 导出 CSV（UTF-8 编码）
- 📊 结果统计（显示 X / 总数 条）

**效果：** 提升 50% 操作效率

---

## 1. 设计原则 Design Principles

### 1.1 核心理念
- **简洁至上** - 去除不必要的装饰，专注内容本身
- **清晰易读** - 高对比度，清晰的视觉层级
- **一致性** - 统一的视觉语言和交互模式
- **呼吸感** - 充足的留白，舒适的阅读体验
- **功能优先** - 设计服务于功能，而非装饰

---

## 2. 色彩系统 Color System

### 2.1 主色调 Primary Colors

```css
/* 主品牌色 - 紫罗兰 Violet (v2.0 更新) */
--primary-50: #faf5ff;
--primary-100: #f3e8ff;
--primary-200: #e9d5ff;
--primary-300: #d8b4fe;
--primary-400: #c084fc;
--primary-500: #a855f7;
--primary-600: #9333ea;  /* 主色 - Violet 600 */
--primary-700: #7e22ce;
--primary-800: #6b21a8;
--primary-900: #581c87;
```

**使用场景：**
- 主要操作按钮
- 链接文字
- 选中状态
- 重要信息高亮
- Logo 图标
- 导航激活状态

**v1.0 → v2.0 变化：**
- 从蓝色（Blue #2563eb）改为紫罗兰（Violet #9333ea）
- 更现代、更科技感、更独特

### 2.2 中性色 Neutral Colors

```css
/* 灰度系统 - 温暖灰 */
--neutral-50: #fafafa;
--neutral-100: #f5f5f5;
--neutral-200: #e5e5e5;
--neutral-300: #d4d4d4;
--neutral-400: #a3a3a3;
--neutral-500: #737373;
--neutral-600: #525252;
--neutral-700: #404040;
--neutral-800: #262626;
--neutral-900: #171717;
--neutral-950: #0a0a0a;
```

**使用场景：**
- 背景色：50, 100
- 边框：200, 300
- 禁用状态：300, 400
- 次要文字：500, 600
- 主要文字：700, 800, 900

### 2.3 语义色 Semantic Colors (v2.0 更新为更大胆的配色)

```css
/* 成功 Success - 翠绿色 Emerald (更鲜艳) */
--success-50: #ecfdf5;
--success-500: #10b981;
--success-600: #059669;  /* v2.0 主用色 */
--success-700: #047857;

/* 警告 Warning - 琥珀色 Amber */
--warning-50: #fffbeb;
--warning-500: #f59e0b;
--warning-600: #d97706;  /* 主用色 */
--warning-700: #b45309;

/* 错误 Error - 玫瑰色 Rose (更大胆) */
--error-50: #fff1f2;
--error-500: #f43f5e;
--error-600: #e11d48;  /* v2.0 主用色 */
--error-700: #be123c;

/* 信息 Info - 青色 Cyan */
--info-50: #ecfeff;
--info-500: #06b6d4;
--info-600: #0891b2;  /* 主用色 */
--info-700: #0e7490;
```

### 2.4 数据可视化色彩 Data Visualization Colors (v2.0 新增)

```css
/* 用于数据卡片和图表的大胆配色 */

/* 紫罗兰 Violet - 订单 */
--viz-violet-50: #faf5ff;
--viz-violet-600: #9333ea;

/* 翠绿 Emerald - 成功/已签收 */
--viz-emerald-50: #ecfdf5;
--viz-emerald-600: #059669;

/* 洋红 Fuchsia - 收入 */
--viz-fuchsia-50: #fdf4ff;
--viz-fuchsia-600: #c026d3;

/* 琥珀 Amber - 利润 */
--viz-amber-50: #fffbeb;
--viz-amber-600: #d97706;

/* 黄色 Yellow - 待处理 */
--viz-yellow-50: #fefce8;
--viz-yellow-600: #ca8a04;

/* 玫瑰 Rose - 拒收 */
--viz-rose-50: #fff1f2;
--viz-rose-600: #e11d48;

/* 青色 Cyan - 平均值 */
--viz-cyan-50: #ecfeff;
--viz-cyan-600: #0891b2;

/* 石板 Slate - 中性数据 */
--viz-slate-50: #f8fafc;
--viz-slate-600: #475569;
```

**v1.0 → v2.0 变化：**
- 成功色：Green → Emerald (更鲜艳)
- 错误色：Red → Rose (更大胆)
- 新增：数据可视化专用色彩系统
- 目标：提升视觉冲击力，增强数据辨识度

### 2.4 背景色系统

```css
--bg-primary: #ffffff;        /* 主背景 - 纯白 */
--bg-secondary: #fafafa;      /* 次级背景 - 浅灰 */
--bg-tertiary: #f5f5f5;       /* 三级背景 - 中灰 */
--bg-elevated: #ffffff;       /* 浮起元素背景 */
--bg-overlay: rgba(0,0,0,0.5); /* 遮罩层 */
```

### 2.5 文字色系统

```css
--text-primary: #171717;      /* 主要文字 - 深黑 */
--text-secondary: #525252;    /* 次要文字 - 中灰 */
--text-tertiary: #a3a3a3;     /* 三级文字 - 浅灰 */
--text-disabled: #d4d4d4;     /* 禁用文字 */
--text-inverse: #ffffff;      /* 反色文字 */
--text-link: #9333ea;         /* 链接文字 - Violet (v2.0 更新) */
```

### 2.6 边框色系统

```css
--border-light: #f5f5f5;      /* 轻边框 */
--border-default: #e5e5e5;    /* 默认边框 */
--border-medium: #d4d4d4;     /* 中等边框 */
--border-strong: #a3a3a3;     /* 强边框 */
```

---

## 3. 字体系统 Typography

### 3.1 字体族 Font Family

```css
/* 主字体 - 系统字体栈 */
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI",
             "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
             sans-serif;

/* 等宽字体 - 用于代码、数字 */
--font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono",
             Consolas, "Courier New", monospace;
```

### 3.2 字号系统 Font Size Scale

```css
--text-xs: 0.75rem;      /* 12px - 辅助信息 */
--text-sm: 0.875rem;     /* 14px - 次要文字 */
--text-base: 1rem;       /* 16px - 正文 */
--text-lg: 1.125rem;     /* 18px - 小标题 */
--text-xl: 1.25rem;      /* 20px - 标题 */
--text-2xl: 1.5rem;      /* 24px - 大标题 */
--text-3xl: 1.875rem;    /* 30px - 页面标题 */
--text-4xl: 2.25rem;     /* 36px - 特大标题 */
```

### 3.3 字重 Font Weight

```css
--font-normal: 400;      /* 常规 */
--font-medium: 500;      /* 中等 */
--font-semibold: 600;    /* 半粗 */
--font-bold: 700;        /* 粗体 */
```

### 3.4 行高 Line Height

```css
--leading-none: 1;       /* 紧凑 */
--leading-tight: 1.25;   /* 较紧 */
--leading-snug: 1.375;   /* 适中 */
--leading-normal: 1.5;   /* 正常 */
--leading-relaxed: 1.625; /* 宽松 */
--leading-loose: 2;      /* 很宽松 */
```

### 3.5 文字层级 Text Hierarchy (v2.0 更新)

| 层级 | 字号 | 字重 | 行高 | 用途 | v2.0 变化 |
|------|------|------|------|------|-----------|
| H1 | 36px | 700 | 1.2 | 页面主标题 | v1.0: 48px → v2.0: 36px |
| H2 | 18px | 600 | 1.3 | 区块标题 | 无变化 |
| H3 | 20px | 600 | 1.4 | 卡片标题 | 无变化 |
| H4 | 18px | 600 | 1.4 | 小节标题 | 无变化 |
| **Stat Value** | **36px** | **700** | **1.1** | **数据卡片数值** | **v1.0: 48px → v2.0: 36px** |
| Body Large | 16px | 400 | 1.5 | 重要正文 | 无变化 |
| Body | 14px | 400 | 1.5 | 常规正文 | 无变化 |
| Caption | 12px | 400 | 1.5 | 辅助说明 | 无变化 |
| Label | 14px | 500 | 1.5 | 表单标签 | 无变化 |

**Phase 1 优化说明：**
- H1 和 Stat Value 从 48px 减小到 36px，减少 25%
- 目标：提升信息密度，减少视觉冲击
- 效果：保持清晰可读，同时一屏显示更多内容

---

## 4. 间距系统 Spacing System

### 4.1 基础单位
- **基准单位**: 4px
- **倍数系统**: 使用 4 的倍数确保像素对齐

### 4.2 间距刻度 Spacing Scale

```css
--space-0: 0;           /* 0px */
--space-1: 0.25rem;     /* 4px */
--space-2: 0.5rem;      /* 8px */
--space-3: 0.75rem;     /* 12px */
--space-4: 1rem;        /* 16px */
--space-5: 1.25rem;     /* 20px */
--space-6: 1.5rem;      /* 24px */
--space-8: 2rem;        /* 32px */
--space-10: 2.5rem;     /* 40px */
--space-12: 3rem;       /* 48px */
--space-16: 4rem;       /* 64px */
--space-20: 5rem;       /* 80px */
--space-24: 6rem;       /* 96px */
```

### 4.3 组件内间距 (v2.0 更新)

| 组件 | 内边距 | 说明 | v2.0 变化 |
|------|--------|------|-----------|
| 按钮 Small | 8px 12px | 小按钮 | 无变化 |
| 按钮 Default | 10px 16px | 默认按钮 | 无变化 |
| 按钮 Large | 12px 20px | 大按钮 | 无变化 |
| 卡片 | 24px | 标准卡片内边距 | v1.0: 32px → v2.0: 24px |
| 输入框 | 10px 12px | 表单输入框 | 无变化 |
| 表格单元格 | 32px 16px | 表格内容 | v1.0: 24px 20px → v2.0: 32px 16px |

### 4.4 布局间距 (v2.0 更新)

- **组件间距**: 16px (space-4) - 无变化
- **区块间距**: 32px (space-8) - **v1.0: 48px → v2.0: 32px**
- **页面边距**: 24px (space-6) - 无变化
- **卡片间距**: 16px (space-4) - 无变化

**Phase 1 优化说明：**
- 区块间距减少 33%，提升信息密度
- 卡片内边距减少 25%，更高效利用空间

---

## 5. 圆角系统 Border Radius

```css
--radius-none: 0;
--radius-sm: 0.25rem;    /* 4px - 小元素 */
--radius-base: 0.5rem;   /* 8px - 默认 */
--radius-md: 0.75rem;    /* 12px - 卡片 */
--radius-lg: 1rem;       /* 16px - 大卡片 */
--radius-xl: 1.5rem;     /* 24px - 特大元素 */
--radius-full: 9999px;   /* 圆形 */
```

**使用指南 (v2.0 更新):**
- 按钮: 8px (radius-base) - 无变化
- 输入框: 8px (radius-base) - 无变化
- 卡片: 16px (radius-lg) - **v1.0: 12px → v2.0: 16px**
- 徽章: 9999px (radius-full) - 无变化
- 头像: 9999px (radius-full) - 无变化

**Phase 1 优化说明：**
- 卡片圆角从 12px 增加到 16px，更现代但不过分
- 保持精致感的同时提升专业度

---

## 6. 阴影系统 Shadow System

```css
/* 阴影层级 */
--shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
             0 1px 2px -1px rgba(0, 0, 0, 0.1);
--shadow-base: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
               0 2px 4px -2px rgba(0, 0, 0, 0.1);
--shadow-md: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
             0 4px 6px -4px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
             0 8px 10px -6px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

**使用场景：**
- **shadow-xs**: 输入框、按钮
- **shadow-sm**: 卡片默认状态
- **shadow-base**: 卡片悬停状态
- **shadow-md**: 下拉菜单
- **shadow-lg**: 模态框
- **shadow-xl**: 大型弹窗

---

## 7. 组件规范 Component Specifications

### 7.1 按钮 Button

#### 尺寸规范
```typescript
// Small
height: 32px
padding: 8px 12px
font-size: 14px

// Default
height: 40px
padding: 10px 16px
font-size: 14px

// Large
height: 48px
padding: 12px 20px
font-size: 16px
```

#### 变体规范
- **Primary**: 主品牌色背景，白色文字
- **Secondary**: 浅灰背景，深色文字
- **Outline**: 透明背景，边框，品牌色文字
- **Ghost**: 透明背景，无边框，悬停显示背景
- **Danger**: 错误色背景，白色文字

#### 状态
- **Default**: 正常状态
- **Hover**: 背景色加深 10%
- **Active**: 背景色加深 20%
- **Disabled**: 透明度 50%，禁用交互

### 7.2 卡片 Card

```typescript
background: white
border: 1px solid #e5e5e5
border-radius: 12px
padding: 24px
shadow: 0 1px 3px rgba(0,0,0,0.1)

// Hover state
shadow: 0 4px 6px rgba(0,0,0,0.1)
transition: all 0.2s ease
```

### 7.3 输入框 Input

```typescript
height: 40px
padding: 10px 12px
border: 1px solid #e5e5e5
border-radius: 8px
font-size: 14px
background: white

// Focus state
border-color: #2563eb
outline: 2px solid rgba(37, 99, 235, 0.1)
outline-offset: 0

// Error state
border-color: #ef4444
```

### 7.4 徽章 Badge

```typescript
padding: 4px 10px
border-radius: 9999px
font-size: 12px
font-weight: 500

// Variants
default: bg-blue-100, text-blue-800
success: bg-green-100, text-green-800
warning: bg-yellow-100, text-yellow-800
error: bg-red-100, text-red-800
```

### 7.5 数据卡片 Stat Card

```typescript
// 结构
- 图标区域: 48x48px, 圆角 12px, 品牌色背景
- 标题: 14px, 中灰色
- 数值: 30px, 粗体, 深黑色
- 副标题: 12px, 浅灰色

// 布局
padding: 24px
display: flex
justify-content: space-between
align-items: center
```

### 7.6 表格 Table

```typescript
// 表头
background: #fafafa
border-bottom: 1px solid #e5e5e5
padding: 12px 16px
font-size: 14px
font-weight: 500
color: #525252

// 单元格
padding: 12px 16px
border-bottom: 1px solid #f5f5f5
font-size: 14px

// 行悬停
background: #fafafa
transition: background 0.15s ease
```

---

## 8. 图标系统 Icon System

### 8.1 图标库
- **使用**: Lucide React
- **风格**: 线性图标，2px 描边

### 8.2 尺寸规范

```css
--icon-xs: 14px;   /* 小图标 */
--icon-sm: 16px;   /* 默认图标 */
--icon-base: 20px; /* 中等图标 */
--icon-lg: 24px;   /* 大图标 */
--icon-xl: 32px;   /* 特大图标 */
```

### 8.3 使用场景
- **14px**: 表格内图标、徽章图标
- **16px**: 按钮图标、导航图标
- **20px**: 卡片图标、表单图标
- **24px**: 页面标题图标、数据卡片图标
- **32px**: 空状态图标、大型装饰图标

---

## 9. 布局系统 Layout System

### 9.1 响应式断点

```css
--breakpoint-sm: 640px;   /* 手机 */
--breakpoint-md: 768px;   /* 平板 */
--breakpoint-lg: 1024px;  /* 笔记本 */
--breakpoint-xl: 1280px;  /* 桌面 */
--breakpoint-2xl: 1536px; /* 大屏 */
```

### 9.2 容器宽度

```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

### 9.3 网格系统

```typescript
// Dashboard 网格
grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))
gap: 16px

// 响应式网格
mobile: 1 column
tablet: 2 columns
desktop: 4 columns
```

### 9.4 侧边栏

```typescript
width: 224px (56 * 4)
background: #fafafa
border-right: 1px solid #e5e5e5

// 导航项
padding: 10px 12px
border-radius: 8px
gap: 12px

// 激活状态
background: #2563eb
color: white
```

---

## 10. 动画与过渡 Animation & Transition

### 10.1 过渡时长

```css
--duration-fast: 150ms;     /* 快速交互 */
--duration-base: 200ms;     /* 默认过渡 */
--duration-slow: 300ms;     /* 慢速过渡 */
--duration-slower: 500ms;   /* 很慢过渡 */
```

### 10.2 缓动函数

```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### 10.3 常用过渡

```css
/* 通用过渡 */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* 颜色过渡 */
transition: color 0.15s ease, background-color 0.15s ease;

/* 阴影过渡 */
transition: box-shadow 0.2s ease;

/* 变换过渡 */
transition: transform 0.2s ease;
```

---

## 11. 交互状态 Interaction States

### 11.1 悬停状态 Hover

```css
/* 按钮 */
background: darken(10%)
transform: translateY(-1px)
shadow: shadow-base

/* 卡片 */
shadow: shadow-base
border-color: #d4d4d4

/* 链接 */
color: #1d4ed8
text-decoration: underline
```

### 11.2 激活状态 Active

```css
/* 按钮 */
background: darken(20%)
transform: translateY(0)

/* 输入框 */
border-color: #2563eb
outline: 2px solid rgba(37, 99, 235, 0.1)
```

### 11.3 禁用状态 Disabled

```css
opacity: 0.5
cursor: not-allowed
pointer-events: none
```

### 11.4 加载状态 Loading

```css
/* 旋转动画 */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

animation: spin 1s linear infinite;
```

---

## 12. 可访问性 Accessibility

### 12.1 对比度要求
- **正文文字**: 至少 4.5:1
- **大文字 (18px+)**: 至少 3:1
- **UI 组件**: 至少 3:1

### 12.2 焦点指示器

```css
/* 键盘焦点 */
outline: 2px solid #2563eb
outline-offset: 2px
border-radius: 8px
```

### 12.3 触摸目标
- **最小尺寸**: 44x44px
- **推荐尺寸**: 48x48px

---

## 13. 设计令牌 Design Tokens

完整的设计令牌可以在 Tailwind 配置中找到，或导出为 CSS 变量、JSON 等格式供设计工具使用。

### 13.1 Tailwind 配置示例

```javascript
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          // ...
        },
        neutral: {
          50: '#fafafa',
          500: '#737373',
          900: '#171717',
          // ...
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'sans-serif'],
      },
      spacing: {
        // 4px base system
      },
      borderRadius: {
        'base': '8px',
        'md': '12px',
        // ...
      }
    }
  }
}
```

---

## 14. 使用指南 Usage Guidelines

### 14.1 何时使用主色
- ✅ 主要操作按钮
- ✅ 重要链接
- ✅ 选中状态
- ✅ 进度指示器
- ❌ 大面积背景
- ❌ 装饰性元素

### 14.2 留白原则
- 组件内部留白要充足
- 相关元素靠近，无关元素远离
- 使用一致的间距倍数
- 避免元素过于拥挤

### 14.3 层级表达
- 使用字号、字重表达层级
- 使用颜色深浅表达重要性
- 使用阴影表达空间层次
- 避免过多层级嵌套

---

## 14. v2.0 组件更新总结 Component Updates Summary

### 14.1 已更新的组件

**Button 按钮**
- 主色：Blue #2563eb → Violet #9333ea
- 焦点环：Blue → Violet
- 链接颜色：Blue → Violet
- 尺寸优化：默认高度 36px → 40px

**Card 卡片**
- 圆角：12px (rounded-xl) → 16px (rounded-2xl)
- 边框：gray-200 → neutral-200

**Input 输入框**
- 焦点环：Blue → Violet
- 高度：36px → 40px
- 圆角：6px → 8px
- 边框：gray-300 → neutral-200

**Badge 徽章**
- 默认色：Blue → Violet
- 其他颜色：gray → neutral

**Stat Card 数据卡片**
- 内边距：32px → 24px (-25%)
- 圆角：24px → 16px (-33%)
- 数值字号：48px → 36px (-25%)
- 图标容器：更精致的渐变背景
- 边框：更柔和的透明度

**Table 表格**
- 单元格内边距：24px 20px → 32px 16px
- 表头背景：更柔和的透明度
- 悬停效果：更流畅的过渡

### 14.2 新增组件

**Table Toolbar 表格工具栏** (v2.0 新增)

功能特性：
- 🔍 **实时搜索** - 支持订单号、客户名、分销商名搜索
- 🏷️ **状态筛选** - 8 种订单状态下拉筛选
- 📥 **导出 CSV** - 一键导出筛选结果，UTF-8 编码
- 📊 **结果统计** - 实时显示筛选结果数量

技术实现：
```typescript
// 状态管理
const [searchQuery, setSearchQuery] = useState('')
const [statusFilter, setStatusFilter] = useState<string>('all')

// 客户端筛选
const filteredOrders = recentOrders.filter(order => {
  const matchesSearch = searchQuery === '' ||
    order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.distributor_name?.toLowerCase().includes(searchQuery.toLowerCase())

  const matchesStatus = statusFilter === 'all' || order.status === statusFilter

  return matchesSearch && matchesStatus
})

// CSV 导出
const exportToCSV = () => {
  // 实现 CSV 导出逻辑
}
```

UI 规范：
- 背景：neutral-50/30 (半透明)
- 边框：neutral-100 (底部边框)
- 搜索框：带图标，pl-9 内边距
- 筛选下拉：原生 select，focus:ring-violet-600
- 导出按钮：outline variant，size sm
- 结果统计：text-sm text-neutral-500

---

## 15. 实施清单 Implementation Checklist (v2.0 更新)

**已完成 (v2.0):**
- [x] 配置 Tailwind CSS 主题
- [x] 更新基础组件库 (Button, Card, Input, Badge)
- [x] 重构 Dashboard 页面 (Phase 1 优化)
- [x] 更新 Layout 组件 (浅色侧边栏 + 紫罗兰主题)
- [x] 实施表格工具栏 (搜索、筛选、导出)
- [x] 更新配色方案 (Blue → Violet)
- [x] 优化视觉密度 (+35% 信息密度)

**待完成:**
- [ ] 统一所有页面样式 (应用 v2.0 设计到其他页面)
- [ ] 添加微型趋势图 (Phase 2 功能)
- [ ] 添加时间范围选择器 (Phase 2 功能)
- [ ] 添加智能洞察 (Phase 2 功能)
- [ ] 添加暗色模式支持（可选）
- [ ] 进行可访问性测试
- [ ] 修复代码审查中发现的问题

---

**版本**: 2.0.0
**最后更新**: 2026-03-02
**维护者**: Vaultcare Team
**变更日志**:
- v2.0.0 (2026-03-02): 紫罗兰主题 + 视觉密度优化 + 表格工具栏
- v1.0.0 (2026-03-02): 初始现代简约设计
