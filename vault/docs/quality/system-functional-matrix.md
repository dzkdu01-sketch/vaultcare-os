# 系统功能与测试矩阵（母表）

> 更新时间：2026-03-05
> 定位：这是"系统功能状态"的**唯一真相**。圆桌纪要只做背景，不做状态结论。
> 多站点前提：**同一分销商账号可管理多个站点（UAE 站、TH 站…）**，因此"站点（Site）"是第一维度。
> owner：质量负责人（待指定）
> last_verified_at：2026-03-05

## 字段规范（每条 L3 流程功能必填）
- **ID**：用于被测试剧本引用（例：`PIM-1.1.3`）
- **适用站点**：`UAE` / `TH` / `ALL`
- **角色**：`系统管理员` / `商品管理员` / `分销商` / `销售&ERP`
- **频率**：`高频` / `低频`
- **状态**：见下方图例
- **证据**：只有填写证据，才允许标记为 🟢

## 状态图例（统一枚举）
- 🔴 **Bug**：已实现但行为错误/不生效
- 🟡 **缺失 - 待评估开发**：当前缺失，需要 PM+ERP 做合理性/依赖/优先级初评
- 🟣 **已实现 - 待验证**：从 `CURRENT_STATUS.md`/代码可见已实现，但缺少可复测验收证据
- 🟢 **已验证 OK**：已按测试剧本验证通过（必须附证据）
- ⚪ **暂缓/不做**：明确暂不纳入或被替代（写理由）

---

## 1. 模块：商品管理（PIM）

### 1.1 子模块：商品列表与检索
- **PIM-1.1.1 基础搜索（编码/名称）** | 适用站点：`ALL` | 角色：`商品管理员`, `分销商` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（SE-01），`OrdersPage.tsx` 搜索框 + 后端 List API
- **PIM-1.1.2 排序（updated_at）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：`backend/pim/views.py` ordering_fields 已含 updated_at，2026-03-03 复测通过
- **PIM-1.1.3 受众标签 chip 筛选（她用/他用/情侣）** | 适用站点：`ALL` | 角色：`商品管理员`, `分销商` | 频率：高频 | 状态：🟢 | 证据：2026-03-04 S1-B 验收通过，`ProductsPage.tsx:1202-1215` chip 点击调用 `toggleAudienceTag`，后端 `views.py:72-85` 支持多参数过滤
- **PIM-1.1.4 统计条快速过滤（未分类/缺阿语/缺图片）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：2026-03-04 S1-B 验收通过，`ProductsPage.tsx:1066-1068` 点击调用 `handleStatClick`，后端 `views.py:381-393` `/api/products/stats/` 返回统计数据
- **PIM-1.1.5 多条件组合筛选（品类 + 状态 + 标签交集）** | 适用站点：`ALL` | 角色：`商品管理员`, `分销商` | 频率：高频 | 状态：🟡 | 证据：圆桌 2 需 PM 确认交互与性能边界
- **PIM-1.1.6 供应商/属性筛选（如"QR 独有"）** | 适用站点：`ALL` | 角色：`商品管理员`, `分销商` | 频率：高频 | 状态：🟡 | 证据：圆桌 2 需定义"QR 独有"口径（供应商=QR? 还是独家标签？）
- **PIM-1.1.1b 旧商品编码升级（一键生成 vc- 规范码）** | 适用站点：ALL | 角色：系统管理员 | 频率：低频 | 状态：🟢 | 证据：后端 upgrade_code 接口已实现；前端列表页"更多"菜单支持"升级编码"操作；测试 pim.tests.test_pim_f12_upgrade_code 通过（4/4）

### 1.2 子模块：商品详情与编辑
- **PIM-1.2.1 商品详情页基础展示（多 Tab）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：`ProductDetailPage.tsx` 已支持草稿保存后的详情展示与品类/图片正确渲染；2026-03-04 回归通过（`pim.tests.test_pim_f1_ai_draft`、`pim.tests.test_pim_f2_manual_draft`）
- **PIM-1.2.2 WP 映射 Tab（查看同步状态/错误）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：低频 | 状态：🟢 | 证据：W4 角色走查验证通过（D-02），`ProductDetailPage.tsx` WP 映射 Tab + `GET /api/products/{id}/wp_mappings/`
- **PIM-1.2.3 供应商 SKU 绑定/编辑/删除** | 适用站点：`ALL` | 角色：`商品管理员`, `销售&ERP` | 频率：高频 | 状态：🟢 | 证据：`ProductDetailPage.tsx` SupplierSkusTab 已实现增删改，2026-03-03 代码审查确认
- **PIM-1.2.4 价格行内编辑（表格双击）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（PM-03），Sprint 5 已完成（Enter 保存/Escape 取消）

### 1.3 子模块：批量操作（Bulk Action）
- **PIM-1.3.1 批量操作 API（bulk_action）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：2026-03-04 S1-B 验收通过，后端 `views.py:396-460` 支持 `activate/deactivate/delete` 等动作，前端 `ProductsPage.tsx:863-881` 实现批量操作浮条
- **PIM-1.3.2 批量上下架** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：2026-03-04 S1-B 验收通过，`ProductsPage.tsx:1617-1620` 批量下架按钮调用 `runBulkAction('deactivate')`，操作后自动刷新列表和统计
- **PIM-1.3.3 批量修改标签（增/删）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：后端 `bulk_action` 支持 `add/remove_audience_tags` 和 `add/remove_operational_tags`；前端 `ProductsPage.tsx` 已实现双弹窗；测试 `pim.tests.test_pim_f5_bulk_tags` 通过（2/2）

### 1.4 子模块：导入/导出（Import/Export）
- **PIM-1.4.1 按当前筛选导出 CSV** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（PM-06），`GET /api/products/export/` + 前端导出按钮
- **PIM-1.4.2 导入 CSV 批量更新商品** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：低频 | 状态：🟢 | 证据：`backend/pim/views.py import_csv` 已按共识实现"master_code 不存在逐行失败并继续"；2026-03-04 测试通过（`pim.tests.test_pim_f3_import_csv`）
- **PIM-1.4.3 导入结果报告（成功/跳过/失败明细）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：低频 | 状态：🟢 | 证据：后端返回 `success_count/failed_count/failed_rows`，前端 `ProductsPage.tsx` 已展示"行号 + 原因"；2026-03-04 测试与联调通过
- **PIM-1.4.4 导入批次审计与失败行追踪（F17-V1）** | 适用站点：`ALL` | 角色：`商品管理员`, `系统管理员` | 频率：低频 | 状态：🟢 | 证据：新增 `ImportBatch/ImportBatchRow` 与 `GET /api/products/import-batches/`；测试 `pim.tests.test_pim_f17_import_batch` 通过（2/2）
- **PIM-1.4.5 仅重试失败行（F17-V1）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：低频 | 状态：🟢 | 证据：新增 `POST /api/products/import-batches/{batch_id}/retry-failed/`，支持失败行修复后重试并回写 `fixed/failed`；合并回归通过（16/16）
- **PIM-1.4.6 48h 升级提醒标记（F17-V1）** | 适用站点：`ALL` | 角色：`商品管理员`, `系统管理员` | 频率：低频 | 状态：🟢 | 证据：2026-03-04 S1-A 验收通过，批次列表返回 `needs_escalation`，`send-alert` 接口支持 message/email 通道；测试 `pim.tests.test_pim_f17_import_batch` 通过（6/6）

### 1.5 子模块：标签字典与治理
- **PIM-1.5.1 运营标签（OperationalTag）基础字典维护** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟢 | 证据：W4 角色走查验证通过（S-01），`OperationalTag` 模型 + 后端 CRUD 接口
- **PIM-1.5.2 自定义标签字典后台（新增/改名/颜色/排序）** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟡 | 证据：圆桌 2 决定是否引入"可自定义标签"
- **PIM-1.5.3 标签删除/合并/级联** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟡 | 证据：需定义对历史数据与筛选一致性的处理策略

### 1.5.x 子模块：AI 配置（Task 1）
- **PIM-1.5.4 AI 配置管理（/settings/ai）** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟢 | 证据：后端 `AIConfig` 模型 + `/api/ai-config/` CRUD；前端 `/settings/ai` 页面；超管可保存配置
- **PIM-1.5.5 AI 模型选择（主模型/降级模型）** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟢 | 证据：`AIConfig.primary_model/fallback_model` 字段；`ai_service.py` 动态读取配置，OCR/文案接口使用配置
- **PIM-1.5.6 AI 功能开关（OCR/文案/审核助手）** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟢 | 证据：`AIConfig.ocr_enabled/copywriting_enabled/review_assistant_enabled` 字段
- **PIM-1.5.7 AI 降级策略（重试次数/超时时间）** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟢 | 证据：`AIConfig.enable_fallback/max_retries/timeout_seconds` 字段；`_call_with_retry` 动态读取
- **PIM-1.5.8 API Key 加密存储** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟢 | 证据：API Key 通过环境变量 `CLAUDE_API_KEY` 配置，不存储数据库；接口不返回明文


### 1.6.x 子模块：审核辅助标记（Task 3）
- **PIM-1.6.6 AI 辅助程度标记（none/ocr/optimize/both）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：`MasterSKU.ai_assisted` 字段；手动新增保存时标记；审核列表展示
- **PIM-1.6.7 OCR 识别接口（/api/ai/ocr-analyze/）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：`AIOCRAnalyzeView` 实现；前端 Step1 AI 识别按钮；结果确认对话框
- **PIM-1.6.8 文案优化接口（/api/ai/optimize-text/）** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：`AIOptimizeTextView` 实现；前端 Step2 AI 优化按钮；对比对话框
- **PIM-1.6.9 降级模式提示** | 适用站点：`ALL` | 角色：`商品管理员` | 频率：高频 | 状态：🟢 | 证据：AI 服务不可用时返回 `degraded=true`；前端提示"AI 服务暂不可用，请手动填写"


### 1.6 子模块：发布门禁与审批（F13）
- **PIM-1.6.1 发布门禁（三态：draft/pending_review/publishable）** | 适用站点：`ALL` | 角色：`商品管理员`, `审核员` | 频率：中频 | 状态：🟢 | 证据：`backend/pim/models.py` 新增 `review_status`，`backend/pim/views.py` 在上架动作前校验"仅 publishable 可上架"；测试 `pim.tests.test_pim_f13_publish_gate` 通过（6/6）
- **PIM-1.6.2 审核动作（提交/通过/驳回）** | 适用站点：`ALL` | 角色：`商品管理员`, `审核员` | 频率：中频 | 状态：🟢 | 证据：`POST /api/products/{id}/submit_review|approve_review|reject_review` 已实现；前端 `ProductDetailPage.tsx` 已接入基础按钮；回归 `pim.tests.test_pim_f13_publish_gate pim.tests.test_pim_f1_ai_draft pim.tests.test_pim_f2_manual_draft pim.tests.test_pim_f3_import_csv` 通过（11/11）
- **PIM-1.6.3 老板紧急放行留痕** | 适用站点：`ALL` | 角色：`系统管理员 (老板)` | 频率：低频 | 状态：🟢 | 证据：`POST /api/products/{id}/emergency_publish/` 已实现（仅 superuser 可执行，必须填写 reason，自动留痕并上架）；测试 `pim.tests.test_pim_f13_publish_gate` 通过（8/8），合并回归通过（13/13）
- **PIM-1.6.4 F13 指标看板接入** | 适用站点：`ALL` | 角色：`商品管理员`, `审核员`, `系统管理员` | 频率：中频 | 状态：🟢 | 证据：`GET /api/products/review_metrics/` 已实现（一次通过率/退回重提/紧急放行/待审核）；前端 `DashboardPage.tsx` 已展示 4 张指标卡；测试 `pim.tests.test_pim_f13_metrics` 通过（1/1），合并回归通过（14/14）
- **PIM-1.6.5 第 1 阶段业务指标（审核效率）** | 适用站点：`ALL` | 角色：`商品管理员`, `审核员`, `系统管理员` | 频率：中频 | 状态：🟢 | 证据：`GET /api/products/phase1_metrics/` 已实现（当日可审核数/审核员日处理量/中位时长/7 天趋势）；前端 `DashboardPage.tsx` 和 `ProductsPage.tsx` 已展示指标卡与趋势图；测试 `pim.tests.test_pim_f13_metrics` 通过（4/4），合并回归通过（44/44）

---

## 2. 模块：订单管理（OMS）

### 2.1 子模块：订单列表与检索
- **OMS-2.1.1 订单列表搜索（订单号/客户/电话）** | 适用站点：`ALL` | 角色：`销售&ERP` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（SE-01），`OrdersPage.tsx` 搜索框实现
- **OMS-2.1.2 订单状态筛选** | 适用站点：`ALL` | 角色：`销售&ERP` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（SE-01），`OrdersPage.tsx` 状态筛选下拉
- **OMS-2.1.3 订单详情抽屉（查看明细/改状态）** | 适用站点：`ALL` | 角色：`销售&ERP` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（SE-01），`OrdersPage.tsx` 详情抽屉

### 2.2 子模块：新建订单与加购（快捷录单）
- **OMS-2.2.1 选择分销商创建订单** | 适用站点：`ALL` | 角色：`销售&ERP` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（SE-02），`OrdersPage.tsx` openQuickEntry
- **OMS-2.2.2 加购选择商品（搜索下拉列表）** | 适用站点：`ALL` | 角色：`销售&ERP` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（SE-02），`ProductSearchSelect` 组件实现
- **OMS-2.2.3 加购快速搜索（按 SKU/名称）** | 适用站点：`ALL` | 角色：`销售&ERP` | 频率：高频 | 状态：🟢 | 证据：2026-03-05 开发完成，`ProductSearchSelect` 组件实现，支持 `master_code`/`title_en`/`title_ar` 搜索
- **OMS-2.2.4 加购筛选（品类/受众标签/运营标签）** | 适用站点：`ALL` | 角色：`销售&ERP` | 频率：高频 | 状态：🟢 | 证据：2026-03-05 开发完成，`ProductSearchSelect` 组件支持品类/受众标签筛选（她用/他用/情侣）
- **OMS-2.2.5 批量录入 SKU（粘贴/扫码枪）** | 适用站点：`ALL` | 角色：`销售&ERP` | 频率：高频 | 状态：🟢 | 证据：2026-03-05 开发完成，`BulkEntryDialog` 组件支持粘贴文本和扫码枪连续录入

### 2.3 子模块：路由引擎与利润
- **OMS-2.3.1 触发路由引擎（Route）** | 适用站点：`ALL` | 角色：`销售&ERP` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（SE-03），`backend/oms/views.py` route 接口
- **OMS-2.3.2 成本/利润展示与计算** | 适用站点：`ALL` | 角色：`销售&ERP` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（SE-03），OrdersPage 利润计算逻辑

---

## 3. 模块：分销商多站点（同一账号）（Distributor Multi-Site）

### 3.1 子模块：站点资产与上下文
- **DIST-3.1.1 同一分销商配置多个站点（WPSite 多条）** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟢 | 证据：W4 角色走查验证通过（D-02），`wp_sync.WPSite` 模型 + WPSitesPage
- **DIST-3.1.2 站点上下文切换（UAE 站/TH 站）** | 适用站点：`ALL` | 角色：`分销商`, `销售&ERP` | 频率：高频 | 状态：🟡 | 证据：新业务前提；现 UI 无显式切换（P2 待增强）

### 3.2 子模块：选品与同步（到站点）
- **DIST-3.2.1 分销商选品（DistributorSelection）** | 适用站点：`ALL` | 角色：`分销商` | 频率：高频 | 状态：🟢 | 证据：W4 角色走查验证通过（D-01），`DistributorSelectionPage.tsx` + `POST /api/distributor-selections/bulk_create/`
- **DIST-3.2.2 按站点推送到 WP（WPProductMapping）** | 适用站点：`UAE`,`TH` | 角色：`分销商`, `系统管理员` | 频率：高频 | 状态：🟢 | 证据：后端新增 `POST /api/distributors/{id}/site_operation/`（publish/revoke/retry_sync，单站失败隔离）；测试 `sites.tests.test_f18_site_operations` 通过（5/5，含失败隔离：502 + mapping failed）；页面回归已验证失败链路与重试按钮可用
- **DIST-3.2.3 分站点选品导出（给 UAE 站/TH 站）** | 适用站点：`UAE`,`TH` | 角色：`分销商` | 频率：高频 | 状态：🟡 | 证据：需求明确（更新各自网站），需定义导出格式（Woo/Shopify/CSV）
- **DIST-3.2.4 营销素材包导出（多语言）** | 适用站点：`UAE`,`TH` | 角色：`分销商` | 频率：高频 | 状态：🟡 | 证据：`docs/modules/products/spec.md` 已规划 WhatsApp 素材包（需扩展站点语言维度）

---

## 4. 模块：多币种/多语言与定价（站点维度）

### 4.1 子模块：币种与汇率
- **FX-4.1.1 站点默认币种显示（UAE=AED；TH=THB）** | 适用站点：`UAE`,`TH` | 角色：`分销商`, `销售&ERP` | 频率：高频 | 状态：🟡 | 证据：现系统货币显示偏 AED；需引入"站点币种"上下文
- **FX-4.1.2 汇率字典维护（AED↔THB 等）** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟡 | 证据：需决定手动维护还是 API 拉取
- **FX-4.1.3 站点一口价/加价规则（基于 AED 折算）** | 适用站点：`TH` | 角色：`系统管理员`, `分销商` | 频率：中频 | 状态：🟡 | 证据：PM+ERP 初评后确定数据模型（站点价表/规则表）

### 4.2 子模块：供应商与品牌
- **SUP-4.2.1 供应商库维护（QR/VIP…）** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟣 | 证据：`pim.Supplier` 模型存在（待验证管理入口）

---

## 5. 模块：WP 站点与同步（wp_sync）

### 5.1 子模块：WP 站点管理（连接资产）
- **WPS-5.1.1 WP 站点 CRUD（创建/编辑/删除/启用）** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟢 | 证据：W4 角色走查验证通过（S-01），`WPSitesPage.tsx` + WP 站点 CRUD 接口
- **WPS-5.1.2 同一分销商多站点配置（UAE 站+TH 站各一条）** | 适用站点：`ALL` | 角色：`系统管理员` | 频率：低频 | 状态：🟣 | 证据：`WPSitesPage` 支持选择分销商并添加多站点

### 5.2 子模块：商品到 WP 的推送/映射
- **WPS-5.2.1 站点级商品映射（WPProductMapping）可视化** | 适用站点：`UAE`,`TH` | 角色：`商品管理员` | 频率：低频 | 状态：🟣 | 证据：`CURRENT_STATUS.md` 已实现 `wp_mappings` Tab；分销选品页新增"站点上下文状态"面板（待补前端复测）
- **WPS-5.2.2 重新推送/重试同步按钮** | 适用站点：`UAE`,`TH` | 角色：`商品管理员` | 频率：低频 | 状态：🟢 | 证据：2026-03-04 S1-C 模拟链路验证通过，`POST /api/distributors/{id}/site_operation/` 支持 `publish/revoke/retry_sync` 动作，`simulate_success` 测试通道已验证；测试 `sites.tests.test_f18_site_operations` 通过（7/7）
