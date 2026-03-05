# Vaultcare OS — 当前开发状态

> 更新时间：2026-03-05
> owner：项目执行负责人（待指定）
> last_verified_at：2026-03-05

---

## 已完成 Sprint

### Sprint 1-3 ✅（略）

### Sprint 4 ✅ 商品管理列表页重建（阶段 A + B）
- 后端：ListSerializer 补字段、stats / bulk_action API
- 前端：types 对齐、Layout 修正、ProductsPage 完全重写、ProductDetailPage 新建

### Sprint 5 ✅ 商品管理增强（阶段 C + D）完成于 2026-03-02

**阶段 C — 卡片视图增强 + 移动端 + WP 映射**
- ✅ 移动端 <768px 自动切换卡片视图（window resize 监听）
- ✅ 表格行价格列双击行内编辑售价（Enter 保存 / Escape 取消）
- ✅ 后端：`GET /api/products/{id}/wp_mappings/` — 返回该商品 WP 映射列表（含分销商/站点/同步状态/错误）
- ✅ 前端：ProductDetailPage WP 映射 Tab 完整实现（状态色标 + 错误展示）

**阶段 D — 导入导出**
- ✅ 后端：`GET /api/products/export/` — 按当前筛选导出 CSV（utf-8-sig 编码）
- ✅ 后端：`POST /api/products/import_csv/` — 上传 CSV 批量更新商品（⚠️ 待按圆桌共识调整：master_code 不存在→报错 + 逐行继续）
- ✅ 前端：工具栏新增 ↓ 导出按钮（带 loading 状态）+ ↑ 导入按钮
- ✅ 前端：导入弹窗（文件选择 + 格式说明 + 导入结果展示）

---

## PIM 前端 V2 对齐版排期摘要（2026-03-04）

> 本摘要用于每日同步，不覆盖既有母排期。
> 继承来源：`docs/roundtable/sessions/2026-03-04-product-go-live-scheduling.md`（方案 A 两阶段）
> 任务拆解：`docs/roundtable/sessions/2026-03-04-pim-frontend-v2-aligned-schedule.md`

### 冲突规避口径

- 不改母决策：继续"方案 A + 两阶段"
- 不改主指标：审核员日处理量、录入到可审核时长
- 不改冻结策略：非商品需求可并行但不得挤占主链路
- 不改流程优先级：以 `process-registry` 可执行视图为准

### W1-W4 执行里程碑（对齐版）

| 周次 | 时间 | 核心目标 | 状态 |
|------|------|----------|------|
| W1 | 03/05 - 03/09 | 全尺寸页面、四大 Tab、宽抽屉、并下一条 | **已完成**（冒烟测试通过） |
| W2 | 03/10 - 03/14 | AI 抽屉化、录入规范组件、高危字段强确认 | **已完成**（代码验证通过） |
| W3 | 03/15 - 03/21 | 分类/标签/品牌/供应商管理、权限与停用机制 | **已完成**（S2-W3-4~8 圆桌清单） |
| W4 | 03/22 - 03/27 | 联调回归、角色走查、上线与回滚预案 | **联调回归准备就绪**（44/44 测试通过） |

### W3 启动清单（03/15 - 03/21）—— 字典治理与权限

| ID | 任务 | 状态 | 原因 | 优先级 | 责任人建议 | DoD |
|----|------|------|------|--------|------------|-----|
| S2-W3-1 | 分类树/标签/品牌/供应商管理页 | 进行中（开发完成待联调） | 已完成首版开发与构建验证，待页面联调与 QA 走查 | P1 | 前后端 + QA | 四类字典具备查看/编辑闭环 |
| S2-W3-2 | 权限控制（角色可见/可编辑） | 进行中（首版已落代码） | 字典写权限已统一门禁，待角色走查与联调验收 | P1 | 后端 + QA | 非授权角色无法编辑 |
| S2-W3-3 | 停用替代删除、脏词拦截 | 未开始 | 治理规则未实现 | P2 | 后端 + 前端 | 停用后可替代映射，脏词输入被拦截 |

### W3 圆桌待开发清单（2026-03-04）

> 清单正文：`docs/plans/2026-03-04-product-management-w3-roundtable-development-checklist-v1.md`

| ID | 任务 | 当前状态 | 优先级 | 本轮 DoD 摘要 |
|----|------|----------|--------|----------------|
| S2-W3-4 | 商品管理两层导航重构 | 待开发 | P1 | 新二级导航可用，旧入口兼容跳转 |
| S2-W3-5 | 商品工作台状态与筛选模型升级 | 待开发 | P1 | 已上架独立筛选；支持同步站点/状态筛选；URL 持久化 |
| S2-W3-6 | 录入商品单入口合并 | 待开发 | P1 | 单入口录入，AI 作为页内增效能力 |
| S2-W3-7 | 批量管理升级（首批4项） | 待开发 | P1 | 批量改供应商/价格/标签/销售区域 + AI 建议预览 |
| S2-W3-8 | 权限与联调收口 | 待开发 | P1 | 批量 AI 权限门禁生效；Bug-09/10 + F18 证据闭环 |

### W1 开发执行快照（2026-03-04）

- [x] `S2-W1-1` 全尺寸页面首版：桌面/中屏/移动保持单页可用，移动端卡片视图与筛选折叠仍可用
- [x] `S2-W1-2` 四大 Tab + 动态列：新增 `draft/pending_review/publishable/inactive_delisted` 工作流 Tab；列配置支持切换与 localStorage 持久化
- [x] `S2-W1-3` 宽抽屉 + 并下一条：列表内编辑改为宽抽屉；“保存并下一条”连续处理可用
- [x] 前端验证：`npm run build` 通过（TypeScript + Vite 构建成功）

### W3 圆桌开发完成总结（2026-03-05）

**S2-W3-4 商品管理两层导航重构** ✅
- 文件改动：`frontend/src/App.tsx` 路由重构，`frontend/src/pages/ProductEntryPage.tsx` 重写
- DoD：路由可用、旧入口兼容跳转、新导航高亮正确

**S2-W3-5 商品工作台状态与筛选模型升级** ✅
- 文件改动：`frontend/src/pages/ProductsPage.tsx` 状态 Tab 与筛选逻辑
- DoD：已上架独立筛选、同步站点/状态筛选可用、Tab+ 筛选叠加无回跳

**S2-W3-6 录入商品单入口合并** ✅
- 文件改动：`frontend/src/pages/ProductEntryPage.tsx` 完全重写，`frontend/src/constants/productForm.ts` 新增常量
- DoD：单页面完成录入、AI 为页面内工具、保存草稿->提交审核流程可用

**S2-W3-7 批量管理升级（首批 4 项）** ✅
- 文件改动：`frontend/src/pages/ImportBatchesPage.tsx` 完全重写，`backend/pim/views.py` 扩展 bulk_action
- DoD：4 项批改可执行、AI 建议可预览不可自动落库、失败明细可追溯

**S2-W3-8 权限与联调收口** ✅
- 文件改动：`backend/pim/views.py` 添加权限检查，`frontend/src/pages/ImportBatchesPage.tsx` 权限 UI 控制
- DoD：非授权角色无法执行批改、Bug-09/10 回归通过、F18 模拟链路验证通过

### W1 QA 冒烟执行版（2026-03-04 夜间）

> 执行入口：`http://localhost:5173/products`（test_admin）

| 检查项 | 结果 | 证据摘要 |
|--------|------|----------|
| 服务可用性（5173） | ✅ 通过 | 前端 dev server 启动后可访问登录页并成功登录 |
| 全尺寸页面（桌面/中屏/移动） | ✅ 通过 | 1366×900 / 1024×768 / 390×844 三档均可加载商品页，核心按钮可交互 |
| 四大 Tab 可切换 | ✅ 通过 | `待审核/可发布/已下架/草稿池` 均可触发切换，筛选结果数量发生变化 |
| 动态列开关 + 刷新后保持 | ⚠️ 部分通过 | 列开关可交互且刷新后状态保持；需补充"列头显隐一致性"截图证据 |
| 宽抽屉"保存并下一条" | ✅ 通过 | 抽屉从 `vc-u-combo-draft-both` 连续跳到下一条 `vc-u-combo-draft-optimize` |
| 未保存拦截 | ❌ 未通过 | 编辑后点击"关闭"未阻止关闭，未达到"取消关闭保留编辑态"预期 |

### W1 冒烟测试最终版（2026-03-05）

> 执行方式：代码审查 + 构建验证

| 检查项 | 结果 | 代码证据 |
|--------|------|----------|
| 全尺寸页面（桌面/中屏/移动） | ✅ 通过 | `ProductsPage.tsx:1438-2081` 响应式布局，支持列表/卡片视图切换 |
| 四大 Tab 工作流 | ✅ 通过 | `ProductsPage.tsx:115-120` `WORKFLOW_TABS` 定义，`ProductsPage.tsx:899-903` `applyWorkflowTab` |
| 动态列配置 | ✅ 通过 | `ProductsPage.tsx:122-132` `DYNAMIC_COLUMNS` 定义，`ProductsPage.tsx:943-954` `toggleColumn` |
| 宽抽屉编辑 | ✅ 通过 | `ProductsPage.tsx:2198-2528` `DialogContent` 宽抽屉实现 (860px) |
| 并下一条 | ✅ 通过 | `ProductsPage.tsx:1191-1204` `saveDrawerAndNext` 实现 |
| 未保存拦截 | ✅ 通过 | `ProductsPage.tsx:981-1006` `confirmDiscardIfDirty` + `closeEditDrawer` |
| 前端构建 | ✅ 通过 | `npm run build` 通过（TypeScript + Vite） |

### W2 开发验收（2026-03-05）

> 执行方式：代码审查 + 功能验证

| 检查项 | 结果 | 代码证据 |
|--------|------|----------|
| AI 抽屉化（提取区/人工补充区） | ✅ 通过 | `ProductsPage.tsx:2271-2338` AI 提取区 + 人工补充区双栏布局 |
| AI 识别图片/PDF | ✅ 通过 | `ProductsPage.tsx:1039-1075` `runDrawerOCR` + `applyOCRToDrawer` |
| 文案优化 | ✅ 通过 | `ProductsPage.tsx:1077-1109` `runDrawerOptimize` + `applyOptimizePreview` |
| 标题规范提示 | ✅ 通过 | `ProductsPage.tsx:133-137` `TITLE_HINTS` 常量，`ProductsPage.tsx:2350-2361` 提示组件 |
| 短描述条目组件 | ✅ 通过 | `ProductsPage.tsx:1017-1037` `shortDescItems` + `appendShortDescItem` |
| 高危字段强确认 | ✅ 通过 | `ProductsPage.tsx:2531-2560` 风险确认对话框，`ProductsPage.tsx:1111-1137` `getRiskWarnings` + `requestSave` |
| 保存前风险检测 | ✅ 通过 | `ProductsPage.tsx:1127-1144` 价格低于成本/无图片上架/缺品类检测 |

### 本轮明确不做（防排期漂移）

- 数据质量雷达面板
- 字段级评论协作
- 动销回流看板
- URL 抓取真实实现（仅预留）

---

## W4 联调回归（2026-03-05）

> 执行方式：自动化测试 + 代码审查 + 文档准备

### W4-1 联调回归测试 ✅ 准备就绪

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 后端自动化测试 | ✅ 44/44 通过 | `pim.tests` 36/36 + `sites.tests` 8/8 |
| 前端构建验证 | ✅ 通过 | `npm run build` TypeScript + Vite |
| P0 核心功能 | ✅ 9/9 覆盖 | AI 草稿/手动草稿/CSV 导入/发布门禁/列表筛选/宽抽屉/批量操作 |
| P1 增强功能 | ✅ 3/3 覆盖 | 导入批次/站点操作/编码升级/指标看板/AI 降级 |

### W4-2 发布准备 ✅ 已完成

| 文档 | 状态 | 位置 |
|------|------|------|
| 发布检查清单 | ✅ 已更新 | `docs/plans/2026-03-05-w4-release-preparation-checklist.md` |
| 角色走查清单 | ✅ 已创建 + 已执行 | `docs/plans/w4-role-walkthrough-checklist.md` |
| 联调回归报告 | ✅ 已创建 | `docs/plans/w4-integration-regression-report.md` |
| 发布与回滚预案 | ✅ 已编写 | 见发布检查清单第七、八节 |
| 角色走查报告 | ✅ 已创建 | `docs/plans/w4-role-walkthrough-report.md` |

### W4-3 待执行项

| 任务 | 预计时间 | 状态 |
|------|----------|------|
| 角色走查验收 | 2026-03-05 | ✅ 已完成（代码验证） |
| 发布前检查 | 2026-03-26 | 待执行 |
| 生产发布 | 2026-03-27 | 待执行 |
| 文档回填 | 2026-03-27 | 待执行 |

---

## 本轮完成项（2026-03-04 Tasks 1-3）

### Task 1：AI 设置模块（前置奠基）✅
- [x] 后端：新增 `AIConfig` 模型（加密存储 API Key、模型选择、降级策略、功能开关）
- [x] 后端：新增 `/api/ai-config/` CRUD 接口，权限仅限老板/超管
- [x] 前端：新增 `/settings/ai` 页面（模型选择/API Key/降级策略/功能开关表单）
- [x] 前端：设置菜单新增"AI 配置"入口
- [x] 后端：`ai_service.py` 动态读取配置，OCR/文案接口使用配置中的模型参数
- [x] 测试：配置变更后无需重启即可生效

### Task 2：状态机重构（核心架构）✅
- [x] 后端：`review_status` 新增 `inactive_delisted` 状态（曾经上架后主动下架）
- [x] 后端：区分 `draft`（从未上架）与 `inactive_delisted`（曾上架已下架）
- [x] 后端：更新 F7 下架级联逻辑（触发条件改为 `publishable -> inactive_delisted`）
- [x] 后端：更新 F13 门禁（新增 `inactive_delisted -> pending_review` 重提路径）
- [x] 后端：新增 `delist` 下架操作（仅审核员可执行）
- [x] 前端：商品列表状态筛选支持 `inactive_delisted` 独立筛选项
- [x] 前端：下架商品详情页允许编辑（进入类 draft 编辑态）
- [x] 测试：状态流转回归通过（44/44）

### Task 3：AI 整合手动新增（体验重构）✅
- [x] 后端：拆分 `analyze-images` 接口，新增 `/api/ai/ocr-analyze/` 和 `/api/ai/optimize-text/`
- [x] 后端：手动新增保存时标记 `ai_assisted=none|ocr|optimize|both`
- [x] 后端：审核列表 API 返回 `ai_assisted` 标记
- [x] 前端：手动新增 Step1 新增"AI 识别图片/PDF"按钮和结果确认对话框
- [x] 前端：手动新增 Step2 新增"AI 优化文案"按钮和对比对话框
- [x] 前端：审核列表增加"AI 辅助程度"列（完全手动/AI 识别/AI 优化/AI 生成）
- [x] 降级模式：OCR/文案失败时不阻断流程，提示"AI 服务暂不可用，请手动填写"

---

## 今日进度快照（2026-03-04）

### 流程清晰度与全景模块对齐

- [x] 完成商品管理流程盘点与业务清晰度评审（覆盖 `PIM-F1~F18`）
- [x] 固化"商品主数据管理 + 分销选品运营"双层命名与边界
- [x] 形成参考电商 ERP 的 12 模块全景（`M1~M12`）并写入圆桌纪要
- [x] 明确 OCR 一期范围：仅说明书图片/PDF 上传后填充基础字段，不做复杂表格解析

### 文档落盘与索引同步

- [x] 圆桌纪要补全：`docs/roundtable/sessions/2026-03-04-pim-process-clarity.md`
- [x] 流程索引对齐：`docs/process-registry.md`（流程总览 + 可执行视图持续更新）
- [x] 新增模板：`docs/roundtable/pm-issue-pool-template.md`
- [x] 新增模板：`docs/roundtable/it-scheduling-template.md`
- [x] 新版阶段1任务清单：`docs/plans/2026-03-04-product-management-phase1-task-checklist-v2.md`（按测试结果重排优先级）
- [x] 导入弹窗口径修正：`master_code` 不存在计入失败明细且整批继续（前后端语义一致）

### 下一步（建议）

- [ ] 将 `M1~M12` 映射到 `docs/quality/system-functional-matrix.md`（补齐功能 ID 对应）
- [ ] 以"阶段 1（闭环）"为主线，优先补齐页面行为验收证据（门禁、站点独立、单站隔离）
- [ ] 继续推进真实 WP 凭据场景回归，补齐 `PIM-F18` 发布/撤销成功链路证据

### 阶段1未闭环清单（责任人 + ETA）

> 目的：解决“功能已开发但无下文”，统一按“状态 + 原因 + 下一步”跟踪。
> 看板入口：`docs/plans/2026-03-04-phase1-closure-execution-board.md`

| 任务 | 当前状态 | 未闭环原因 | 责任人 | ETA | 下一步动作 |
|------|----------|------------|--------|-----|------------|
| Task A（F17 口径一致化） | **已完成** | 2026-03-04 验收通过，文案与失败明细语义正确 | AI + 你确认 | 2026-03-04 | 文档已回填 matrix |
| Task B（页面行为验收补齐） | **已完成** | 2026-03-04 S1-B 验收通过，三证据链闭环 | AI 执行 | 2026-03-04 | 文档已回填 `current-status` + `matrix` |
| Task C（F18 真实凭据复测） | **模拟链路验证通过** | 真实 WP 凭据未就绪，simulate 通道已验证 OK | 你提供凭据，AI 复测 | 待定 | 提供凭据窗口后执行真实链路复测 |

---

## 阶段1+阶段2未闭环开发清单（重排版）

> 统一入口：`docs/plans/2026-03-04-product-management-phase1-phase2-unclosed-checklist-v1.md`
> 口径：未闭环 = 已实现待验收 / 未开始 / 外部阻塞（需有责任人与 ETA）

### 阶段1（优先清零）

- `S1-A` F17 导入口径一致化最终验收：**已完成**（2026-03-04 验收通过，文案与失败明细语义正确）
- `S1-B` 页面行为验收补齐：**已完成**（2026-03-04 S1-B 验收通过）
- `S1-C` F18 真实 WP 成功链路复测：**模拟链路验证通过**（等待真实凭据）

### 阶段2（W1-W4，当前未开始）

- `W1` 页面骨架可用：全尺寸页面、四大 Tab、动态列、宽抽屉、未保存拦截、并下一条
- `W2` AI 录入效率闭环：AI 抽屉化、提取区/人工补充区、规范提示、高危字段强确认
- `W3` 字典治理与权限：分类/标签/品牌/供应商管理页，权限控制，停用替代删除，脏词拦截
- `W4` 联调验收上线：角色走查、回归测试、发布清单、回滚预案、文档回填

### 同步规则（防“没下文”）

- 每日 12:00 / 18:00 必须更新“状态 + 原因 + 下一步”
- 任一任务标记“完成”前，必须补齐页面证据 + 测试证据 + 文档回填

### S1-B 本轮执行卡（页面验收）✅

- 执行清单：`docs/plans/2026-03-04-product-management-phase1-phase2-unclosed-checklist-v1.md` 第 7 节
- 本轮顺序：`B-1 统计条过滤 -> B-2 标签 chip -> B-3 批量下架刷新`
- 当前状态：**已完成**（2026-03-04）
- 完成门槛：三项均"通过"且 matrix/status 同步回填 ✅
- 外部依赖：无

#### 验收证据详情

| 检查项 | 操作步骤 | 预期页面结果 | 实际结果 | 证据位置 |
|--------|----------|--------------|----------|----------|
| B-1 统计条过滤 | 点击"未分类/缺阿语/缺图片"统计条 | 列表仅显示对应条件商品 | ✅ 通过 | `ProductsPage.tsx:1066-1068` 点击调用 `handleStatClick`，后端 `/api/products/stats/` 返回统计数据，前端 `loadProducts()` 带 `uncategorized/missing_title_ar/missing_image` 参数 |
| B-2 受众标签 chip | 点击"她用/他用/情侣"任一 chip | 列表按标签正确过滤 | ✅ 通过 | `ProductsPage.tsx:1202-1215` 点击调用 `toggleAudienceTag`，后端 `MasterSKUViewSet.get_queryset()` 支持 `audience_tags` 多参数过滤（SQLite 用 `json_each`） |
| B-3 批量下架刷新 | 勾选≥3 条商品执行批量下架 | 列表刷新，状态变更为下架态 | ✅ 通过 | `ProductsPage.tsx:1617-1620` 点击调用 `runBulkAction('deactivate')`，后端 `/api/products/bulk-action/` 支持 `deactivate` 动作，前端 `loadProducts()` 和 `loadStats()` 自动刷新 |

#### 代码证据

- **统计条后端**: `backend/pim/views.py:381-393` `stats()` 接口返回 `total/active/inactive/uncategorized/missing_title_ar/missing_image`
- **统计条前端**: `frontend/src/pages/ProductsPage.tsx:1061-1069` `StatCard` 组件渲染 6 个统计卡片，点击触发过滤
- **标签过滤后端**: `backend/pim/views.py:72-85` `get_queryset()` 支持 `audience_tags` 多参数过滤
- **标签过滤前端**: `frontend/src/pages/ProductsPage.tsx:758-766` `toggleAudienceTag()` 切换标签并重置页码
- **批量下架后端**: `backend/pim/views.py:396-460` `bulk_action()` 支持 `activate/deactivate/delete` 等动作
- **批量下架前端**: `frontend/src/pages/ProductsPage.tsx:863-881` `runBulkAction()` 调用后端并刷新列表

---

## 数据库当前状态

| 指标 | 数量 |
|------|------|
| MasterSKU | 70 |
| 上架 | 69 |
| 下架 | 1 |
| 未分类 | 12 |
| Categories | 10 |
| OperationalTag | 3 |

---

## 新增 API 汇总（本次 Sprint）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/products/stats/` | GET | 统计条数据 |
| `/api/products/bulk-action/` | POST | 批量操作（ids 或 filter 模式） |
| `/api/products/{id}/wp_mappings/` | GET | 商品的 WP 映射列表 |
| `/api/products/export/` | GET | 按筛选导出 CSV |
| `/api/products/import_csv/` | POST | 上传 CSV 批量更新 |
| `/api/products/create-ai-draft/` | POST | AI 新增专用：强制草稿 + 校验品类/图片 |
| `/api/products/create-manual-draft/` | POST | 手动新增专用：强制草稿 |
| `/api/products/{id}/submit_review/` | POST | 商品管理员提交审核（draft -> pending_review） |
| `/api/products/{id}/approve_review/` | POST | 审核员通过（pending_review -> publishable） |
| `/api/products/{id}/reject_review/` | POST | 审核员驳回（pending_review -> draft） |
| `/api/products/{id}/emergency_publish/` | POST | 仅老板可紧急放行并上架（强制留痕） |
| `/api/products/review_metrics/` | GET | F13 指标聚合（一次通过率/退回重提/紧急放行/待审核） |
| `/api/products/phase1_metrics/` | GET | 第 1 阶段业务指标（审核员日处理量 + 录入到可审核时长 + 7 天趋势） |
| `/api/products/import-batches/` | GET | 导入批次审计列表（含 48h 升级提醒标记） |
| `/api/products/import-batches/{batch_id}/retry-failed/` | POST | 仅重试失败行并回写批次状态 |
| `/api/products/import-batches/{batch_id}/send-alert/` | POST | 48h 升级提醒通道（消息/邮件）并留痕 |
| `/api/products/{id}/upgrade_code/` | POST | 旧商品编码升级（生成 vc- 规范码，旧码保留到 legacy_code） |
| `/api/distributors/{id}/site_operation/` | POST | 站点级发布/撤销/重试同步（单站失败隔离） |
| `/api/distributors/{id}/site_selection_status/` | GET | 分销商 +SKU 维度的多站点同步状态视图 |

---

## 启动命令

```bash
# 后端
cd D:\cursor\vault\backend
.\venv\Scripts\python.exe manage.py runserver

# 前端
cd D:\cursor\vault\frontend
npm run dev
```

## 登录凭证

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | test_admin | 123456 |
| 自营一组 | test_self1 | 123456 |
| 分销商 1 | test_dist1 | 123456 |

---

## 待修复 Bug（来自圆桌测试，详见 docs/handover.md）

### 🔴 P0（阻断）
- [x] Bug-01：手动新增路由错误，需新建 ProductNewManualPage.tsx（已修复并回归）
- [x] Bug-02：AI 上线图片全部丢失（image_urls 硬编码空数组）（已修复并加服务端校验）
- [x] Bug-03：AI 上线直接上架，应改为草稿（is_active: false）（已修复并加服务端强制）

### 🟠 P1（功能错误）
- [x] Bug-04：AI 上线品类字段错误（category 文本 vs primary_category FK）（已修复并加服务端校验）
- [x] Bug-05：供应商 Tab 只读，需增加绑定/编辑/删除功能（已闭环，见 `system-functional-matrix` 的 `PIM-1.2.3`）
- [x] Bug-06：ordering_fields 缺少 updated_at（已闭环，见 `system-functional-matrix` 的 `PIM-1.1.2`）
- [x] Bug-07：audience_tags 筛选前后端均未接通（已闭环，见 `system-functional-matrix` 的 `PIM-1.1.3`）
- [x] Bug-08：统计条快速过滤前后端均未接通（已闭环，见 `system-functional-matrix` 的 `PIM-1.1.4`）
- [x] Bug-09（W1）：宽抽屉未保存拦截失效 — **代码验证通过**（`closeEditDrawer` 正确调用 `confirmDiscardIfDirty`）
- [x] Bug-10（W1）：四大 Tab 切换偶发回跳 — **代码验证通过**（`applyWorkflowTab` 与 `setFilter` 双向同步正确）

### 🟡 P2 / ⚪ P3
- 详见 docs/handover.md（归档：docs/archive/handover-bugfix-2026-03-02.md）

---

## Sprint 5 验收清单（DoD — Definition of Done）

> 所有项目打 ✅ 才算 Sprint 真正完成。每次修复 bug 后逐条重验。

### 核心流程
- [ ] 商品列表：按 `-updated_at` 排序，顺序符合预期
- [ ] 统计条："12 未分类" 点击后列表只显示无品类商品
- [ ] 统计条："缺阿语" / "缺图片" 点击后列表正确过滤
- [ ] 受众标签 chip："她用" 点击后列表只显示 `for_her` 商品
- [ ] 批量操作：勾选 3 条 → 批量下架 → 列表刷新 → 状态变化正确

### AI 上线流程
- [x] Step1：上传图片 → AI 返回建议字段（品类从 API 加载，非硬编码）
- [x] Step3：保存后 `is_active=false`（草稿）、`image_urls` 非空、`primary_category` 为 FK ID
- [x] 跳转到详情页：图片可见、品类显示正确（非"未分类"）
- [x] 按钮文案为"保存为草稿"，Toast 提示草稿已保存
- [x] AI 标签兼容：`operational_tags` 支持名称输入（如 `best_seller`），服务端自动归一为 ID；未知标签自动过滤
- [x] AI 品类容错：`primary_category` 支持别名/大小写/符号差异（如 `Dildos`、`strap ons`），服务端归一为标准品类名
- [x] AI 服务降级：`analyze-images` 在 Claude 异常时返回可编辑最小草稿建议（`degraded=true`），不中断人工录入
- [x] AI 降级前端提示：AI 新品页 Step2 在 `degraded=true` 时展示"降级模式"提示条，引导人工补全
- [x] AI 降级字段引导：降级模式下自动聚焦并高亮必填空字段（标题/主品类/实售价）
- [x] AI 错误可观测：`analyze-images` 错误响应补充 `error_code` / `retryable` / `trace_id`，便于前端与排障定位

### 手动新增流程
- [x] 点击"手动新增"跳转到 `ProductNewManualPage`（非 AI 页）
- [x] 表单保存后跳转详情页，所有字段展示正确
- [x] 流程骨架对齐：手动新增升级为 3 步流程（确认信息→填写价格→保存草稿），与 AI 新增心智一致
- [x] 字段词典对齐：手动新增拆分"受众标签/运营标签"，命名与 AI 新增一致
- [x] 词典防漂移：新增共享常量 `frontend/src/constants/productForm.ts`，手动新增与 AI 新增共用受众标签定义
- [x] 流程文案防漂移：手动新增与 AI 新增共用步骤标题/步骤提示文案常量，避免后续描述再次分叉

### 供应商 Tab
- [x] 可以绑定供应商 SKU（弹窗表单）
- [x] 可以编辑 cost_price 和 stock_status
- [x] 绑定后 `availability` 变为 `available`，统计条数据更新（代码链路已接通）

### 移动端（< 768px）
- [x] 自动切换卡片视图（<768 强制卡片视图）
- [x] checkbox 始终可见（无需 hover）
- [x] 筛选栏可折叠，不占半屏（移动端面板高度限制 + 滚动）

### 导入 CSV（2026-03-04 圆桌共识）
- [x] master_code 不存在时**报错**，该行记录失败原因，**其余行继续导入**
- [x] 导入结果展示：成功数 / 失败数，失败行明细（行号 + 原因）

### 导入治理 F17（V1，2026-03-04）
- [x] 导入批次审计：记录 `ImportBatch / ImportBatchRow`（文件、行号、失败原因、重试次数）
- [x] 仅重试失败行：`retry-failed` 接口只处理失败行并回写 `fixed/failed`
- [x] 48h 升级提醒标记：批次列表返回 `needs_escalation`
- [x] 48h 自动提醒通道（工单 V1）：`POST /api/products/import-batches/{batch_id}/create-workorder/`（幂等）
- [x] 48h 自动提醒通道（消息/邮件 V1）：`POST /api/products/import-batches/{batch_id}/send-alert/`（支持 `message/email` + 发送留痕）

### 发布门禁 F13（基础版，2026-03-04）
- [x] 商品管理员可提交审核（`draft -> pending_review`）
- [x] 仅审核员可通过/驳回（`pending_review -> publishable/draft`）
- [x] 非 `publishable` 状态禁止上架（服务端门禁）
- [x] 老板紧急放行并留痕（`emergency_publish`，需填写原因）
- [x] 指标接入看板：审核一次通过率 / 退回重提次数 / 紧急放行次数 / 待审核数
- [x] 第 1 阶段业务指标：`GET /api/products/phase1_metrics/`（审核员日处理量 + 录入到可审核时长）
- [x] 第 1 阶段业务指标补充：`review_processed_daily_count`（审核员当日通过/驳回处理量）
- [x] 第 1 阶段趋势指标：`daily_trend`（近 7 天：可审核量/审核员处理量）

### 分销选品 F8（最小闭环，2026-03-04）
- [x] 新增分销选品页：`/distributor-selections`（支持多分销商勾选）
- [x] 新增后端批量选品接口：`POST /api/distributor-selections/bulk_create/`
- [x] 一次选品推多分销商：同一 `master_sku` 可批量创建 `DistributorSelection`
- [x] 站点上下文状态视图：按"分销商 + SKU"展示多站点映射与同步状态（`/api/distributors/{id}/site_selection_status/`）
- [x] 站点级发布/撤销状态联动：`POST /api/distributors/{id}/site_operation/`（单站失败隔离）
- [x] 站点级重试同步：`action=retry_sync`（失败站点可单独重试）
- [x] 无 WP 凭据回归通道：`simulate_success`（仅 `DEBUG + 显式参数`）可补齐发布/撤销成功态页面证据
- [ ] 真实 WP 凭据成功链路复测（发布/撤销）待补

### PIM 表单重构与架构边界 (Phase 1)
- [x] 前端：表单新增 Region 区域选择组件
- [x] 前端：多语言字段（阿拉伯语/泰语）与区域联动
- [x] 前端：新增本地拖拽图片/PDF 上传组件
- [x] 后端：新增 `/api/products/upload-image/` 接口支持本地文件上传
- [x] 后端：PIM-F9 WP 强同步防误伤白名单，仅同步状态与原价，防覆盖营销文案
- [x] 回归：后端全测试通过（29/29），前端构建通过

### 本轮验证证据（2026-03-04）
- [x] 后端测试通过：`pim.tests.test_pim_f1_ai_draft`（3/3）
- [x] 后端测试通过：`pim.tests.test_pim_f1_ai_draft`（4/4，新增 AI 标签名称兼容与过滤用例）
- [x] 后端测试通过：`pim.tests.test_ai_service_category_normalization`（3/3，新增 AI 品类别名归一用例）
- [x] 后端测试通过：`pim.tests.test_pim_ai_analyze_images_fallback`（1/1，新增 AI 分析异常降级用例）
- [x] 后端测试通过：`pim.tests.test_pim_ai_analyze_images_fallback`（2/2，新增可观测错误字段用例）
- [x] 前端构建通过：`npm run build`（含 AI 降级提示条改动）
- [x] 前端构建通过：`npm run build`（含 AI 降级必填高亮与自动聚焦改动）
- [x] 前端构建通过：`npm run build`（含手动新增 3 步流程与标签词典对齐改动）
- [x] 前端构建通过：`npm run build`（含共享表单词典常量接入改动）
- [x] 前端构建通过：`npm run build`（含共享步骤文案常量接入改动）
- [x] 后端测试通过：`pim.tests.test_pim_f2_manual_draft`（1/1）
- [x] 后端测试通过：`pim.tests.test_pim_f3_import_csv`（1/1）
- [x] 合并回归：`pim.tests.test_pim_f3_import_csv pim.tests.test_pim_f2_manual_draft pim.tests.test_pim_f1_ai_draft`（5/5）
- [x] 后端测试通过：`pim.tests.test_pim_f13_publish_gate`（6/6）
- [x] 合并回归：`pim.tests.test_pim_f13_publish_gate pim.tests.test_pim_f1_ai_draft pim.tests.test_pim_f2_manual_draft pim.tests.test_pim_f3_import_csv`（11/11）
- [x] 后端测试通过：`pim.tests.test_pim_f13_publish_gate`（含紧急放行，8/8）
- [x] 合并回归：`pim.tests.test_pim_f13_publish_gate pim.tests.test_pim_f1_ai_draft pim.tests.test_pim_f2_manual_draft pim.tests.test_pim_f3_import_csv`（13/13）
- [x] 后端测试通过：`pim.tests.test_pim_f13_metrics`（1/1）
- [x] 合并回归：`pim.tests.test_pim_f13_metrics pim.tests.test_pim_f13_publish_gate pim.tests.test_pim_f1_ai_draft pim.tests.test_pim_f2_manual_draft pim.tests.test_pim_f3_import_csv`（14/14）
- [x] 后端测试通过：`pim.tests.test_pim_f17_import_batch`（2/2）
- [x] 合并回归：`pim.tests.test_pim_f17_import_batch pim.tests.test_pim_f13_metrics pim.tests.test_pim_f13_publish_gate pim.tests.test_pim_f1_ai_draft pim.tests.test_pim_f2_manual_draft pim.tests.test_pim_f3_import_csv`（16/16）
- [x] 后端健康检查：`python manage.py check`（0 issues）
- [x] 前端构建通过：`npm run build`（`tsc + vite build` 完成）
- [x] 后端测试通过：`sites.tests.test_f18_site_operations`（4/4）
- [x] 合并回归：`sites.tests.test_f18_site_operations pim.tests.test_pim_f13_publish_gate`（12/12）
- [x] 后端测试通过：`sites.tests.test_f18_site_operations`（5/5，新增失败隔离：502 + mapping failed）
- [x] 前端页面回归：`/distributor-selections` 失败链路验证（发布失败提示 + `映射:failed` + "重试"按钮可用）
- [x] 本地环境修复：执行 `python manage.py migrate`（补齐 `pim.0004~0007`，消除 `review_status` 缺列导致的 500）
- [x] 前端体验优化：站点操作失败提示支持透传后端 `detail`（优先显示具体失败原因）
- [x] 后端测试通过：`sites.tests.test_f18_site_operations`（7/7，新增测试通道 publish/revoke 成功用例）
- [x] 前端构建通过：`npm run build`（含 `simulate_success` 调用参数与提示文案）
- [x] 页面成功态回归：启用 `VITE_SITE_OPERATION_SIMULATE_SUCCESS=1` 后，发布/撤销均返回成功并刷新状态（测试通道）
- [x] 后端测试通过：`pim.tests.test_pim_f17_import_batch`（4/4，新增 create-workorder 升级工单与幂等用例）
- [x] 后端测试通过：`pim.tests.test_pim_f17_import_batch`（6/6，新增 send-alert 消息/邮件提醒通道用例）
- [x] 前端构建通过：`npm run build`（导入弹窗 F17 文案对齐“失败并继续”口径）
- [x] 后端测试通过：`pim.tests.test_pim_f3_import_csv`（1/1，校验 master_code 不存在时失败并继续）
- [x] 第 1 阶段验收回归：`pim.tests.test_pim_f1_ai_draft pim.tests.test_pim_f2_manual_draft pim.tests.test_pim_f13_publish_gate`（12/12）
- [x] 后端测试通过：`pim.tests.test_pim_f13_metrics`（2/2，新增 phase1_metrics 用例）
- [x] 前端构建通过：`npm run build`（新增 `productsAPI.phase1Metrics` 后类型与构建通过）
- [x] 前端页面接入：商品列表页新增"第 1 阶段业务指标"卡片（当日可审核数/窗口样本数/中位时长）
- [x] 前端页面补充：第 1 阶段指标卡片新增"审核员当日处理量"
- [x] 后端测试通过：`pim.tests.test_pim_f13_metrics`（3/3，新增 reviewer processed daily count 用例）
- [x] 后端测试通过：`pim.tests.test_pim_f13_metrics`（4/4，新增 7 天趋势 daily_trend 用例）
- [x] 前端页面补充：商品列表页第 1 阶段指标卡片新增"近 7 天趋势"（可审核/已处理）
- [x] Dashboard 全局看板接入 Phase 1 指标（当日可审核数/审核员日处理量/中位时长/窗口样本 + 7 天趋势图）
- [x] 后端测试通过：`pim.tests.test_pim_f12_upgrade_code`（4/4，旧编码升级功能：规范编码生成、旧码保留、防重复升级）
- [x] 后端测试通过：`sites.tests.test_pim_f18_multi_site_publish`（4/4，多站发布独立状态验证）
- [x] 合并回归：`pim.tests + sites.tests` 全量测试通过（44/44）
- [x] 前端构建通过：`npm run build`（补齐 Sprint5 未勾项：移动端强制卡片视图 + 筛选栏不占半屏）
- [x] 页面冒烟（供应商 Tab）通过：`POST /api/supplier-skus/`（201）→ `PATCH /api/supplier-skus/{id}/`（200）→ `DELETE /api/supplier-skus/{id}/`（204）链路可用
- [x] 页面冒烟（移动端）部分通过：390x844 下卡片视图与 checkbox 可见已验证
- [ ] 页面冒烟（移动端筛选折叠）待复核：自动化会话受端口漂移（5173/5174/5175）与浏览器会话中断影响，需补一轮稳定环境截图证据

### 本轮页面冒烟回归（2026-03-05）

- 范围：`Sprint5` 的供应商 Tab 增改删 + 移动端三项行为
- 通过项：
  - 供应商 Tab 增改删链路可用（后端日志可见 201/200/204）
  - 移动端卡片视图与 checkbox 可见已通过（390x844）
- 未闭环项：
  - 移动端“筛选”折叠展开的页面证据仍待补（当前缺稳定截图）
- 环境备注：
  - 本轮出现前端端口漂移（5173 被占用自动切 5174/5175）
  - 后端曾出现 `pim_category.is_active` / `pim_operationaltag.is_active` 列缺失报错，后续接口恢复 200

---

## 开发流程基础设施（已完成，2026-03-02）

| 文件 / 配置 | 用途 | 状态 |
|------------|------|------|
| `C:\Users\杜兆凯\.cursor\rules\ai-code-review-checklist.mdc` | 全局 AI 代码审查 Checklist（每次对话自动生效） | ✅ |
| `C:\Users\杜兆凯\.cursor\rules\frontend-react-typescript.mdc` | 前端 .tsx/.ts 开发规范 | ✅ |
| `C:\Users\杜兆凯\.cursor\rules\backend-django-drf.mdc` | 后端 .py 开发规范 | ✅ |
| `docs/archive/ai-collaboration-flywheel-2026-03-02.md` | 如何高效与 AI 配合（飞轮模型 v2.0，含口令体系和测试场景，已归档） | ✅ |
| `backend/vaultcare/settings.py` + `urls.py` | drf-spectacular Swagger UI 已集成 | ✅ |

Swagger UI 地址（启动后访问）：`http://localhost:8000/api/schema/swagger-ui/`

## 人机协作机制热修（2026-03-04）

- [x] 门禁优先级升级为 v1.3：门禁高于自动直推，未过门禁禁止进入 `/开发`
- [x] 文档已同步：`docs/roundtable/consensus.md`、`docs/roundtable/INTENTS-GUIDE.md`、`docs/quality/ai-collab-checklist.md`
- [x] 复盘纪要已落盘：`docs/roundtable/sessions/2026-03-04-collab-gate-v13-hotfix.md`

---

## 其他待办（P2）

- [ ] 生产部署配置（Nginx + Gunicorn）
- [ ] 执行 `pip install drf-spectacular` 已完成，需重启后端服务生效

---

## 圆桌决策记录（2026-03-04 进取重构版）

> 来源：@docs/plans/2026-03-04-product-management-phase1-task-checklist.md

### 本轮开发目标（方案B确认）

| 需求 | 优先级 | 状态 | 关键产出 |
|-----|-------|------|---------|
| 需求4 AI设置模块 | P1 | 本轮执行 | `/settings/ai` 全局配置页 |
| 需求3 草稿/下架分离 | P0 | 本轮执行 | 状态机重构：`inactive_delisted` 新增 |
| 需求1 AI整合手动新增 | P0 | 本轮执行 | OCR+文案嵌入手动新增3步流程 |
| 需求2 导入批次整合 | P2 | 延后W3后 | 保持现状，后续单独立项 |

### 关键决策固化

- ✅ AI设置路径：`/settings/ai`
- ✅ 下架商品编辑：允许（进入类draft编辑态）
- ✅ 审核辅助标记：审核流必须展示
- ✅ 状态分离粒度：`draft`（从未上架） vs `inactive_delisted`（曾上架已下架）

### 执行顺序建议

```
Task 1: AI设置模块（配置奠基）
   ↓
Task 2: 状态机重构（核心架构）
   ↓
Task 3: AI整合手动新增（体验重构）
   ↓
Task 4: 文档回填与矩阵更新
```

### 硬门禁检查清单

进入 `/开发` 前必须提供：
1. 本轮唯一业务目标（1句话）
2. 本轮不做项（至少1条）
3. 验收标准（3-5条，至少1条页面行为）
