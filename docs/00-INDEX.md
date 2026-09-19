# 文档索引与治理说明（00-INDEX）

本文定义仓库内文档如何组织、如何命名、哪些内容可信，以及 AI 与人类在开发前应阅读什么。目标：**文档与代码、部署事实保持一致**，避免过期长文误导实现。

---

## 1. 文档体系目标

| 目标 | 说明 |
|------|------|
| 单一事实来源 | 行为以 **代码与可执行配置** 为准；文档只作索引与说明，冲突时 **以代码为准** 并回写文档。 |
| 可发现 | 入口集中：根目录 [`README.md`](../README.md)、[`docs/01-INDEX.md`](01-INDEX.md)、本文件。 |
| 可维护 | 新文档有固定位置与命名规则；过时内容明确标注或删除。 |
| AI 可用 | 开发前有限集合必读，避免无界上下文。 |

---

## 2. 目录结构（当前）

```text
vault-os-2.0/
├── README.md                 # 项目入口：技术栈、部署入口
├── docs/                     # 现行文档（本目录）
│   ├── 00-INDEX.md           # 本文件：治理与目录规范
│   └── 01-INDEX.md           # 仓库级短索引
├── deploy/                   # 部署、运维、服务器相关
├── backend/                  # Express + SQLite
│   └── data/                 # 运行时库，不进 Git
├── frontend/                 # Vite + React
└── scripts/                  # 本机部署辅助脚本
```

过程数据（订单、商品、同步日志、SKU 对照 CSV、本地 `vaultcare.db`）不进仓库。发版只上代码。

业务底稿 / 方案设计 / 开发过程报告：不放仓库根目录。现行说明进 `docs/`；过期报告不要提交。含密码的凭据（如 FTP）留在工作目录，禁止放进项目。

---

## 3. 现有文档清单与状态

| 路径 | 用途 | 状态 |
|------|------|------|
| [`README.md`](../README.md) | 项目说明、部署入口 | 当前有效 |
| [`docs/01-INDEX.md`](01-INDEX.md) | 极简索引 | 当前有效 |
| [`deploy/DEPLOYMENT.md`](../deploy/DEPLOYMENT.md) | 部署检查清单 | 发版前对照代码 |
| [`deploy/README.md`](../deploy/README.md) | 分步部署 | 与 DEPLOYMENT 同步 |
| [`deploy/DEPLOYMENT-SUMMARY.md`](../deploy/DEPLOYMENT-SUMMARY.md) | 生产速查 | 环境变了就改 |
| [`deploy/secrets.local.example.md`](../deploy/secrets.local.example.md) | 敏感信息模板 | 真实内容勿提交 |
| [`backend/data/README.md`](../backend/data/README.md) | 库文件约定 | 当前有效 |

**代码即文档：**

| 区域 | 权威位置 |
|------|----------|
| HTTP API | `backend/src/routes/*.ts`、`backend/src/index.ts` |
| 数据模型 / 迁移 | `backend/src/db/index.ts` |
| 前端路由 | `frontend/src/app/router/index.tsx` |
| 认证与角色 | `backend/src/middleware/auth.ts` |

---

## 4. 新文档放哪里

| 类型 | 路径 | 命名 |
|------|------|------|
| 文档治理、总索引 | `docs/` | `00-INDEX.md`；子主题 `01-xxx.md` |
| 需求 / 产品说明 | `docs/requirements/` | `FEATURE-<模块>-<简述>.md` |
| 架构决策 | `docs/architecture/` | `ADR-001-<标题>.md` |
| 操作手册 | `docs/how-to/` | `<动作>-<对象>.md` |
| 仅部署 | `deploy/` | 与现有 `DEPLOYMENT*.md` 并列 |

文件名优先英文或拼音；正文可用中文。文档与代码冲突时以代码为准，并回写文档。

---

## 5. 发版前数据

- 本机 `backend/data/vaultcare.db` 视为过程数据，**不要上传到服务器**。
- 清空过程数据（保留站点 / 账号 / 供应商主数据）：`cd backend && node scripts/wipe-operational-data.mjs`（先停 API）。
- 仅清订单：`cd backend && npm run purge-orders`。
- 根目录不要留 `*.csv` 对照表、截图、测试报告。

---

## 6. 给 AI 的约束

修改代码前至少读：根目录 `README.md`、本文、`docs/01-INDEX.md`；涉及部署再读 `deploy/DEPLOYMENT.md`。具体模块直接读对应源文件。

---

## 7. 修订记录

| 日期 | 修订说明 |
|------|----------|
| 2026-04-17 | 初版：`documentation/` 治理说明。 |
| 2026-09-19 | 归位到 `docs/`；发版前去掉过程数据。 |
