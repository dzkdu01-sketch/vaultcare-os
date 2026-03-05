# 圆桌纪要：ERP 整体路径（基于当前业务、流程、人员）

> 日期：2026-03-04  
> 主题：在当前真实组织约束下定义 ERP 理想态、MVP 边界与约束条件  
> 参与角色：ERP 架构专家、业务流程专家、电商运营专家、数据治理专家、集成中台专家、财务合规专家、供应链专家

---

## 一、前提锁定（用户确认）

| 维度 | 确认结果 |
|------|----------|
| 团队结构 | 老板 1、审核人员 1、分销商 1 |
| 系统 Owner | 老板（最终拍板） |
| 业务优先级 | 增长优先：商品快速上线并推送分销 WordPress |
| 订单入口 | 两阶段：先人工录单，2-4 周后接入抓单 |
| 时效目标 | 先跑通闭环，不设强制 SLA |
| 开发资源 | 老板主导 + AI 实现 |
| 分销站点现状 | 当前已有 7 个分销网站 |

---

## 二、关键结论（提取）

1. 当前阶段不做“大而全 ERP”，采用**轻运营台（方案 A）**作为 MVP 主路径。  
2. MVP 以“上新-推送-录单-审核-异常闭环”为主线，先求可执行与可追责。  
3. 订单入口必须保留人工兜底，抓单在第二阶段接入 WooCommerce。  
4. 鉴于已有 7 个分销网站，系统设计从 Day 1 即按“多站点”组织，不能按单站假设。  
5. 架构策略为：**底层数据规范优先 + 标准化模块接口保留**，避免后续重构断层。

---

## 三、MVP 边界（第一阶段）

### 3.1 必做能力

- 商品快速建档（最小字段集）与多站点推送
- 推送状态可见（成功/失败/待重试）
- 人工录单与审核员必审流
- 异常单统一进入“待老板处理”队列
- 操作留痕（谁、何时、做了什么）

### 3.2 暂缓能力

- 复杂财务总账自动化
- 多渠道复杂抓单并发接入
- 高级预测/自动补货算法

### 3.3 第二阶段（2-4 周）

- 接入 WordPress/WooCommerce 抓单
- 人工录单与抓单并行去重
- 订单状态与推送状态联动回写

---

## 四、约束条件清单

| 约束类型 | 约束说明 |
|----------|----------|
| 人员约束 | 3 人组织，流程必须少节点、低维护 |
| 决策约束 | 老板单点拍板，关键异常需老板可见可管 |
| 业务约束 | 以增长效率为先，优先打通“快速上新+分销推送” |
| 技术约束 | 你+AI 实现，优先小步迭代与可回滚 |
| 结构约束 | 已有 7 个分销站点，系统需原生支持多站点配置 |
| 架构约束 | 先统一底层数据口径，保留标准化模块接口 |

---

## 五、待下轮展开（商品管理模块）

- 在本次 ERP 总体决议下，细化商品管理模块目标形态：
  - 多站点商品推送模型
  - 商品最小字段标准与版本策略
  - 推送失败重试与人工接管规则
  - 与订单录入/抓单的字段对齐

---

## 六、Woo 商品导出字段基线（v1）

> 样本来源：`tmp/wc-product-export-2-3-2026-1772439558044.csv`

### 6.1 现状字段 → 目标接口字段

| Woo CSV 字段 | 目标字段 | 说明 |
|--------------|----------|------|
| `ID` | `WPSyncMapping.remote_product_id` | 远端商品 ID |
| `SKU` | `MasterSKU.master_code` | 跨系统业务主键 |
| `Name` | `MasterSKU.title` | 商品标题 |
| `Short description` | `MasterSKU.short_description` | 短描述 |
| `Description` | `MasterSKU.description` | 详情描述（需清洗） |
| `Regular price` | `SiteListing.site_regular_price` | 站点原价 |
| `Sale price` | `SiteListing.site_sale_price` | 站点促销价 |
| `Published` | `SiteListing.publish_status` | 发布状态 |
| `Visibility in catalog` | `SiteListing.visibility` | 可见性（visible/hidden） |
| `Categories` | `MasterSKU.primary_category` + `secondary_categories[]` | 主分类 + 辅分类 |
| `Tags` | `MasterSKU.tags[]` | 标签数组（受众/运营） |
| `Images` | `MasterSKU.image_urls[]` | 图片 URL 数组 |
| `In stock?` | `SiteListing.in_stock` | 库存布尔态 |
| `Stock` | `SiteListing.stock_qty` | 库存数量（可空） |
| `Type` | `MasterSKU.product_type` | simple/variable 等 |

### 6.2 清洗与标准化规则（MVP）

1. `Description` 中 HTML/短代码（如 `[video ...]`）需保留原文并生成清洗文本字段。  
2. `Images` 为逗号拼接字符串，入库时拆分 `image_urls[]` 并 trim 空格。  
3. `Tags` 按字典标准化，受众标签与运营标签分层存储。  
4. 非规范 `SKU`（如随机串）进入修复队列，不直接写入主数据真相层。  
5. 重复商品优先按 `master_code` 聚合，冲突记录写入异常队列。  

### 6.3 三层模型最小接口字段（MVP）

- `MasterSKU`: `master_code`, `title`, `short_description`, `description`, `primary_category`, `tags[]`, `image_urls[]`, `product_type`
- `SiteListing`: `master_code`, `site_id`, `site_regular_price`, `site_sale_price`, `publish_status`, `visibility`, `in_stock`, `stock_qty`
- `WPSyncMapping`: `master_code`, `site_id`, `remote_product_id`, `sync_status`, `last_error`, `retry_count`, `last_synced_at`, `payload_hash`

---

## 七、AI 辅助上新（100品）UI/UX 增补结论

### 7.1 设计目标（审核员主操作）

- 目标：1 名审核员可在可控质量前提下完成 100 条商品上新。
- 原则：批量优先，单条精修兜底；AI 给建议，人工确认生效。

### 7.2 交互策略（双入口同内核）

1. 批量审核台（主入口）：队列列表 + 当前表单 + 素材预览三栏。  
2. 单条录入页（精修入口）：复用同一规则与 AI 服务，不单独造系统。  
3. 单条就地 AI 按钮：
   - 优化标题
   - 标准卖点提炼
   - 竞品链接快速填充
   - 一键补全字段

### 7.3 图片素材治理（MVP）

- 上传即预检（分辨率/比例/格式/疑似水印/中文残留）
- 自动标准化（统一尺寸、格式、背景）
- 风险分层状态：
  - `pass`：直接可用
  - `auto-fixed`：自动修复后可用
  - `manual-required`：需人工确认

### 7.4 可用性约束（必须满足）

- 快捷键：`A` 通过下一条、`R` 驳回、`S` 保存、`N/P` 切换
- 点击目标最小 44x44
- 状态不只靠颜色，需文字与图标双提示
- 错误提示业务化（可执行动作导向）

---

## 本场飞轮备注

- 专家组合：ERP 架构、流程、运营、数据治理、集成中台、财务合规、供应链
- 增补专家：UI/UX 设计专家
- 专家组合有效性：[待用户反馈：有效/无效]
- 待确认问题数：5（已完成确认）
- 决策数量：9（含 UI/UX 增补决议）
- 写入文件：`docs/roundtable/consensus.md`、`docs/roundtable/sessions/2026-03-04-erp-mvp-current-state.md`、`docs/process-registry.md`
