# 页面 S1：AI 服务配置 — 页面设计文档

> 日期：2026-03-09
> 状态：已批准
> 上位文档：`05-页面字段字典.md` §9、`06-API草图.md` §6、`design-system/MASTER.md`

---

## 1. 页面概述

S1 是系统设置模块的唯一页面，用于管理 AI 供应商接入、模型配置和任务路由分配。所有 AI 辅助功能（翻译、优化、规范化、OCR、图片增强）通过后端 `AiService` 抽象层路由到此页面配置的供应商和模型。

**布局方案**：单页纵向三区块（经 brainstorming 确认，选择方案 A）

---

## 2. 页面结构

```
┌─────────────────────────────────────────────────┐
│  侧边栏 (w-64)  │  内容区 (flex-1, p-8)         │
│                  │                               │
│  系统设置 ▸      │  页面标题: AI 服务配置          │
│    AI 服务配置   │                               │
│                  │  ┌─ Zone A: AI 供应商 ────────┐│
│                  │  │  [卡片] [卡片] [+ 添加]    ││
│                  │  └───────────────────────────┘│
│                  │                               │
│                  │  ┌─ Zone B: 任务路由配置 ─────┐│
│                  │  │  表格: 5 行固定任务类型     ││
│                  │  │  每行: 供应商下拉 + 模型下拉││
│                  │  │              [保存路由配置] ││
│                  │  └───────────────────────────┘│
│                  │                               │
│                  │  ┌─ Zone C: 配置变更记录 ─────┐│
│                  │  │  只读表格 + 分页            ││
│                  │  └───────────────────────────┘│
└─────────────────────────────────────────────────┘
```

---

## 3. Zone A — AI 供应商卡片区

### 3.1 布局

- 容器：`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- 最后一个位置始终为「+ 添加供应商」占位卡片（虚线边框）

### 3.2 供应商卡片字段

| 字段 | 显示方式 | 说明 |
|---|---|---|
| 名称 | 卡片标题（font-semibold text-base） | 如 "Moonshot"、"智谱 AI" |
| API 模式 | Badge | `OpenAI 兼容` (violet) / `自定义` (slate) |
| API 主机 | 截断显示（text-sm text-muted） | 如 `api.moonshot.cn` |
| 连接状态 | 状态指示灯 + 文字 | 见 3.3 |
| 模型数量 | 右下角小字 | 如 "3 个模型" |
| 最近检查时间 | 底部小字（text-xs text-muted） | 相对时间，如 "5 分钟前" |

### 3.3 连接状态颜色

| 状态 | 指示灯颜色 | 文字 |
|---|---|---|
| 已连通 | `bg-emerald-500` (绿色圆点，带 pulse 动画) | 已连通 |
| 连接失败 | `bg-red-500` | 连接失败 |
| 未检查 | `bg-slate-300` | 未检查 |

### 3.4 卡片交互

- 悬停：`shadow-md` → `shadow-lg`，`cursor-pointer`
- 点击卡片：打开右侧编辑抽屉（Drawer）
- 「+ 添加供应商」卡片点击：打开空白编辑抽屉

---

## 4. 供应商编辑抽屉（Drawer）

### 4.1 布局

- 方向：从右侧滑入
- 宽度：`w-[500px]`
- 遮罩：`bg-black/20`
- 关闭方式：点击遮罩 / 点击 X / ESC 键

### 4.2 抽屉内容

```
┌─ 抽屉标题栏 ──────────────────────┐
│  编辑供应商 / 添加供应商     [X]  │
├───────────────────────────────────┤
│                                   │
│  名称 *          [___________]    │
│  API 模式 *      [▼ OpenAI 兼容]  │
│  API 密钥 *      [••••••••••]  👁  │
│  API 主机 *      [___________]    │
│  API 路径 *      [___________]    │
│                                   │
│  ── 操作按钮 ──                   │
│  [检查连接]  [获取模型列表]        │
│                                   │
│  ── 模型列表 ──                   │
│  模型名称              操作       │
│  moonshot-v1-8k        [删除]     │
│  moonshot-v1-32k       [删除]     │
│  [+ 手动添加模型]                 │
│                                   │
├───────────────────────────────────┤
│           [删除供应商]    [保存]   │
└───────────────────────────────────┘
```

### 4.3 字段规则

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| 名称 | Input | 是 | 最大 50 字符 |
| API 模式 | Select | 是 | `openai_compatible` / `custom` |
| API 密钥 | Password Input | 是 | 加密存储，显示 `sk-****xxxx`（后 4 位），点击眼睛图标切换明文 |
| API 主机 | Input | 是 | URL 格式校验，如 `https://api.moonshot.cn/` |
| API 路径 | Input | 是 | 兼容模式默认填充 `/chat/completions`，自定义模式为空 |

### 4.4 操作按钮

| 按钮 | 触发 API | 行为 |
|---|---|---|
| 检查连接 | `POST /api/v1/system/ai-providers/{id}/check` | 按钮变为 loading 状态，成功显示绿色 toast，失败显示红色 toast + 错误信息 |
| 获取模型列表 | `POST /api/v1/system/ai-providers/{id}/fetch-models` | 自动刷新下方模型列表，新增模型高亮 2 秒 |
| 删除供应商 | `DELETE /api/v1/system/ai-providers/{id}` | 二次确认弹窗："该供应商下有 N 个模型，且被 M 条任务路由引用，确认删除？"；如有路由引用则阻止删除并提示 |
| 保存 | `POST` 或 `PUT /api/v1/system/ai-providers` | 表单校验通过后提交，成功关闭抽屉并刷新卡片区 |

### 4.5 模型列表（抽屉内）

- 简单列表，每行：模型名称 + 删除按钮
- 「+ 手动添加模型」：展开一行内联 Input + 确认按钮
- 删除模型前检查是否被任务路由引用，有引用则提示

---

## 5. Zone B — 任务路由配置

### 5.1 布局

- 标题：「任务路由配置」
- 说明文字：`text-sm text-muted`，"为每种 AI 任务指定使用的供应商和模型"
- 表格形式，5 行固定

### 5.2 路由表格

| 任务类型 | 供应商（下拉） | 模型（下拉） | 路由状态 |
|---|---|---|---|
| 翻译 (translate) | [▼ 选择供应商] | [▼ 选择模型] | Badge |
| 文案优化 (optimize) | [▼ 选择供应商] | [▼ 选择模型] | Badge |
| 文案规范化 (normalize) | [▼ 选择供应商] | [▼ 选择模型] | Badge |
| 图片识别 OCR (ocr) | [▼ 选择供应商] | [▼ 选择模型] | Badge |
| 图片增强 (image_enhance) | [▼ 选择供应商] | [▼ 选择模型] | Badge |

### 5.3 交互规则

- 供应商下拉：列出所有已添加的供应商（仅显示连接状态为「已连通」的，失败的灰色显示并标注）
- 模型下拉：联动，选择供应商后自动加载该供应商下的模型列表
- 路由状态 Badge：
  - `已配置` → `bg-emerald-50 text-emerald-700 border-emerald-200`
  - `未配置` → `bg-slate-50 text-slate-500 border-slate-200`
  - `供应商不可用` → `bg-red-50 text-red-700 border-red-200`
- 底部「保存路由配置」按钮：调用 `PUT /api/v1/system/ai-task-routes` 批量保存

### 5.4 保存逻辑

- 仅修改过的行才提交（前端 diff）
- 保存成功：绿色 toast "路由配置已保存"
- 允许部分行未配置（不强制全部填写）

---

## 6. Zone C — 配置变更记录

### 6.1 布局

- 标题：「配置变更记录」
- 只读表格 + 底部分页

### 6.2 表格字段

| 列 | 宽度 | 说明 |
|---|---|---|
| 操作时间 | 160px | `YYYY-MM-DD HH:mm:ss` |
| 操作人 | 100px | 用户名 |
| 操作类型 | 120px | 添加供应商 / 更新供应商 / 删除供应商 / 添加模型 / 删除模型 / 更新路由 / 检查连接 |
| 变更内容 | flex-1 | 变更前 → 变更后 的摘要文字 |

### 6.3 分页

- 默认每页 10 条
- API：`GET /api/v1/system/ai-config/audit-log?page=1&page_size=10`

---

## 7. API 对照表

| 操作 | 方法 | 端点 |
|---|---|---|
| 供应商列表 | GET | `/api/v1/system/ai-providers` |
| 添加供应商 | POST | `/api/v1/system/ai-providers` |
| 供应商详情 | GET | `/api/v1/system/ai-providers/{id}` |
| 更新供应商 | PUT | `/api/v1/system/ai-providers/{id}` |
| 删除供应商 | DELETE | `/api/v1/system/ai-providers/{id}` |
| 检查连接 | POST | `/api/v1/system/ai-providers/{id}/check` |
| 获取模型 | POST | `/api/v1/system/ai-providers/{id}/fetch-models` |
| 模型列表 | GET | `/api/v1/system/ai-providers/{id}/models` |
| 添加模型 | POST | `/api/v1/system/ai-providers/{id}/models` |
| 删除模型 | DELETE | `/api/v1/system/ai-providers/{id}/models/{model_id}` |
| 查询路由 | GET | `/api/v1/system/ai-task-routes` |
| 保存路由 | PUT | `/api/v1/system/ai-task-routes` |
| 变更记录 | GET | `/api/v1/system/ai-config/audit-log` |

---

## 8. 设计规范引用

遵循 `design-system/MASTER.md`：

- 卡片：`bg-white rounded-xl border border-slate-200 p-5`
- 抽屉：`bg-white shadow-2xl`，宽度 `w-[500px]`
- 表格：紧凑行高 `h-12`，斑马纹 `even:bg-slate-50`
- 按钮：主按钮 `bg-violet-600 text-white`，次按钮 `border border-slate-300`
- 状态 Badge：圆角 `rounded-full px-2.5 py-0.5 text-xs font-medium`
- 表单：标签在上，间距 `space-y-4`，必填标记红色星号
- Toast：右上角，3 秒自动消失
- 确认弹窗：居中 Dialog，destructive 操作用红色按钮
