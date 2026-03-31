# Vaultcare 一期 API 草图

> 日期：2026-03-09
> 状态：需求确认版（v2）
> 作用：定义三模块主要 API 端点，作为 Gate 5（技术门）的核心交付物
> 上位文档：`04-状态机定义.md`、`05-页面字段字典.md`

---

## 0. 评估摘要

从页面设计、状态机和字段字典推导 API 时，发现以下缺口：

1. **缺少 webhook 接收端点** — 订单回传 webhook 需要平台侧提供接收端点，当前方案只定义了"配置 webhook"但没有定义平台侧的接收 API
2. **缺少批量操作 API** — 页面 1 有批量 AI 翻译/优化/素材处理按钮，需要对应的批量异步 API
3. **缺少留痕查询 API** — 多个页面有留痕区，但没有定义留痕的写入和查询接口
4. **缺少跨模块级联 API** — 商品状态变更触发分销侧级联处理，需要内部事件或 API
5. **拆单 API 未定义** — 订单审核阶段的拆单操作需要独立 API
6. **AI 服务接口未定义** — AI 翻译/优化是外部服务调用，需要定义调用方式和回调

---

## 1. 通用约定

### 1.1 基础路径

```
/api/v1/{module}/{resource}
```

### 1.2 通用响应格式

```json
{
  "code": 200,
  "message": "ok",
  "data": {}
}
```

### 1.3 分页参数

```
?page=1&page_size=20&sort_by=created_at&sort_order=desc
```

### 1.4 留痕写入

所有状态变更 API 自动写入留痕记录，无需单独调用。留痕记录包含：操作人、操作时间、操作类型、变更前状态、变更后状态、备注。

---

## 2. 商品模块 API

### 2.1 商品 CRUD

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| POST | `/api/v1/product/items` | 新建商品（进入 draft） | 页面 1 |
| POST | `/api/v1/product/items/import` | 批量导入商品资料 | 页面 1 |
| GET | `/api/v1/product/items` | 商品列表（支持筛选、分页） | 页面 1 |
| GET | `/api/v1/product/items/{id}` | 商品详情 | 页面 2 |
| PUT | `/api/v1/product/items/{id}` | 更新商品信息 | 页面 2 |
| PUT | `/api/v1/product/items/{id}/draft` | 保存草稿 | 页面 2 |

### 2.2 商品状态流转

| 方法 | 路径 | 说明 | 状态转换 |
|---|---|---|---|
| POST | `/api/v1/product/items/{id}/pool` | 提交入池 | T-P1: draft → pooled |
| POST | `/api/v1/product/items/{id}/identify` | 确认身份 | T-P2: pooled → identified |
| POST | `/api/v1/product/items/{id}/confirm-content` | 确认内容 | T-P3: identified → content_ready |
| POST | `/api/v1/product/items/{id}/confirm-asset` | 确认素材 | T-P4: content_ready → asset_ready |
| POST | `/api/v1/product/items/{id}/distribute` | 提交为可分销 | T-P5: asset_ready → distributable |
| POST | `/api/v1/product/items/{id}/suspend` | 挂起 | T-P6: any → suspended |
| POST | `/api/v1/product/items/{id}/resume` | 恢复 | T-P7: suspended → 挂起前状态 |
| POST | `/api/v1/product/items/{id}/rollback` | 回退到上一状态 | T-P8/9/10/11 |

请求体（状态流转通用）：

```json
{
  "reason": "string (可选，回退和挂起时建议填写)"
}
```

### 2.3 AI 辅助

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| POST | `/api/v1/product/items/{id}/ai/extract` | 单商品原始资料提取（标题/描述/规格结构化）`[v3]` | 页面 2 |
| POST | `/api/v1/product/items/{id}/ai/generate-all` | 单商品 AI 全生成（标题/短描述/长描述/品类/标签/规格）`[v3]` | 页面 2 |
| POST | `/api/v1/product/items/{id}/ai/retry-field` | 单字段重试（标题/短描述/长描述等，最多 3 次）`[v3]` | 页面 2 |
| POST | `/api/v1/product/items/{id}/ai/translate` | 单商品 AI 翻译 | 页面 2 |
| POST | `/api/v1/product/items/{id}/ai/optimize` | 单商品 AI 优化 | 页面 2 |
| POST | `/api/v1/product/items/{id}/ai/normalize` | 单商品文案规范化 | 页面 2 |
| POST | `/api/v1/product/items/{id}/ai/ocr` | 图片/文档 OCR 识别（上传产品说明书、网站截图等）`[补]` | 页面 2 |
| POST | `/api/v1/product/ai/batch-normalize` | 批量 AI 规范化（异步）`[v3]` | 页面 1 |
| POST | `/api/v1/product/ai/batch-translate` | 批量 AI 翻译（异步） | 页面 1 |
| POST | `/api/v1/product/ai/full-refresh` | 存量商品全量刷新（异步）`[v3]` | 页面 1 |
| GET | `/api/v1/product/ai/tasks/{task_id}` | 查询异步 AI 任务状态 | 页面 1 |
| POST | `/api/v1/product/items/{id}/ai/confirm-field` | 人工确认单字段 AI 结果（标题/短描述/长描述/分类/标签）`[v3]` | 页面 2 |
| POST | `/api/v1/product/items/{id}/ai/confirm-batch` | 列表页行内确认整行 AI 结果`[v3]` | 页面 1 |

> 所有 AI 调用通过后端 `AiService` 抽象层路由到页面 S1 配置的供应商和模型，前端无需感知具体供应商。

批量请求体：

```json
{
  "item_ids": ["id1", "id2"],
  "target_language": "ar | th"
}
```

全生成请求体 `[v3]`：

```json
{
  "generate": ["title", "short_description", "long_description", "category", "tags", "specs"],
  "use_raw_materials": true
}
```

单字段重试请求体 `[v3]`：

```json
{
  "field": "title | short_description | long_description | category | tags",
  "reason": "string (可选，告诉 AI 这次要避开什么问题)"
}
```

单字段确认请求体 `[v3]`：

```json
{
  "field": "title | short_description | long_description | category | tags",
  "accepted_value": "string | object",
  "source": "ai_generated | ai_retried | manually_edited"
}
```

列表页整行确认请求体 `[v3]`：

```json
{
  "fields": ["title", "short_description", "long_description", "category", "tags"],
  "accept_all": true
}
```

OCR 请求体 `[补]`：

```json
{
  "file_type": "image | pdf",
  "file_url": "string (OSS 地址)",
  "extract_fields": ["title", "description", "specs", "price"]
}
```

OCR 响应体 `[补]`：

```json
{
  "extracted": {
    "title": "string | null",
    "description": "string | null",
    "specs": "string | null",
    "price": "string | null"
  },
  "confidence": 0.85,
  "raw_text": "string (原始识别文本)"
}
```

### 2.4 素材处理

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| POST | `/api/v1/product/items/{id}/assets` | 上传图片 | 页面 2 |
| DELETE | `/api/v1/product/items/{id}/assets/{asset_id}` | 删除图片 | 页面 2 |
| POST | `/api/v1/product/items/{id}/assets/{asset_id}/set-primary` | 设为主图 | 页面 2 |
| POST | `/api/v1/product/items/{id}/assets/check` | 单商品素材检查（数量/比例/大小/时长，仅提示不自动处理）`[v3]` | 页面 2 |
| POST | `/api/v1/product/items/{id}/assets/process` | 单商品素材处理（尺寸/质量） | 页面 2 |
| POST | `/api/v1/product/items/{id}/assets/ai-enhance` | AI 图片增强（抠图/去背景/白底图）`[补]` | 页面 2 |
| POST | `/api/v1/product/assets/batch-check` | 批量素材检查（异步）`[v3]` | 页面 1 |
| POST | `/api/v1/product/assets/batch-process` | 批量素材处理（异步） | 页面 1 |
| POST | `/api/v1/product/assets/batch-ai-enhance` | 批量 AI 图片增强（异步）`[补]` | 页面 1 |
| POST | `/api/v1/product/items/{id}/assets/confirm` | 人工确认主图 | 页面 2 |

AI 图片增强请求体 `[补]`：

```json
{
  "asset_id": "string",
  "enhance_type": "background_remove | white_bg | image_enhance",
  "options": {}
}
```

### 2.5 门禁查询

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| GET | `/api/v1/product/items/{id}/gates` | 查询商品门禁状态（G-P1~G-P5） | 页面 2 |

响应体：

```json
{
  "gates": [
    { "gate": "G-P1", "status": "passed", "reason": null },
    { "gate": "G-P2", "status": "passed", "reason": null },
    { "gate": "G-P3", "status": "blocked", "reason": "仍有字段待人工确认" }
  ],
  "current_blocked": "G-P3",
  "blocked_reason": "仍有字段待人工确认",
  "unconfirmed_fields": ["short_description"],
  "asset_blockers": ["image_count_lt_4"]
}
```

### 2.6 留痕查询

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/product/items/{id}/audit-log` | 查询商品操作留痕 |

---

## 3. 分销模块 API

### 3.1 分销商 CRUD

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| POST | `/api/v1/distribution/distributors` | 新增分销商 | 页面 3 |
| GET | `/api/v1/distribution/distributors` | 分销商列表 | 页面 3 |
| GET | `/api/v1/distribution/distributors/{id}` | 分销商详情 | 页面 3 |
| PUT | `/api/v1/distribution/distributors/{id}` | 更新分销商 | 页面 3 |
| POST | `/api/v1/distribution/distributors/{id}/enable` | 启用 | 页面 3 |
| POST | `/api/v1/distribution/distributors/{id}/disable` | 停用 | 页面 3 |

### 3.2 站点管理

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| POST | `/api/v1/distribution/distributors/{id}/sites` | 新增站点 | 页面 3 |
| GET | `/api/v1/distribution/distributors/{id}/sites` | 站点列表 | 页面 3 |
| PUT | `/api/v1/distribution/sites/{site_id}` | 更新站点 | 页面 3 |
| POST | `/api/v1/distribution/sites/{site_id}/enable` | 启用站点 | 页面 3 |
| POST | `/api/v1/distribution/sites/{site_id}/disable` | 停用站点 | 页面 3 |

### 3.3 Webhook 管理

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| PUT | `/api/v1/distribution/sites/{site_id}/webhook/publish` | 配置发布 webhook | 页面 3 |
| PUT | `/api/v1/distribution/sites/{site_id}/webhook/order-return` | 配置订单回传 webhook | 页面 3 |
| POST | `/api/v1/distribution/sites/{site_id}/webhook/publish/test` | 测试发布 webhook | 页面 3 |
| POST | `/api/v1/distribution/sites/{site_id}/webhook/order-return/test` | 测试订单回传 webhook | 页面 3 |

### 3.4 选品与发布

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| GET | `/api/v1/distribution/selectable-products` | 可选品商品列表（状态=distributable） | 页面 4 |
| POST | `/api/v1/distribution/selections` | 选品（创建选品关系） | 页面 4 |
| POST | `/api/v1/distribution/selections/batch` | 批量选品 | 页面 4 |
| POST | `/api/v1/distribution/selections/{id}/publish` | 单站发布 | 页面 4 |
| POST | `/api/v1/distribution/selections/batch-publish` | 批量发布 | 页面 4 |
| POST | `/api/v1/distribution/selections/{id}/revoke` | 撤销 | 页面 4 |
| POST | `/api/v1/distribution/selections/{id}/retry` | 重试发布 | 页面 4/5 |

### 3.5 发布回执（平台接收端）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/distribution/webhook/publish-callback` | 接收站点发布回执 `[补]` |

请求体（由站点推送）：

```json
{
  "site_id": "string",
  "product_code": "string",
  "status": "success | failed",
  "message": "string",
  "remote_product_id": "string (站点侧商品ID)"
}
```

### 3.6 发布状态查询

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| GET | `/api/v1/distribution/selections` | 发布关系列表（支持状态筛选） | 页面 5 |
| GET | `/api/v1/distribution/selections/{id}` | 发布关系详情（含回执） | 页面 5 |

### 3.7 留痕查询

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/distribution/selections/{id}/audit-log` | 查询分销操作留痕 |

---

## 4. 订单模块 API

### 4.1 订单接入

| 方法 | 路径 | 说明 | 来源 |
|---|---|---|---|
| POST | `/api/v1/order/webhook/receive` | WordPress 订单回传接收端点 `[补]` | 站点推送 |
| POST | `/api/v1/order/orders` | 手动录入订单（创建草稿） | 页面 6 |

WordPress 订单回传请求体：

```json
{
  "site_id": "string",
  "wp_order_id": "string",
  "wp_order_status": "processing",
  "customer": {
    "name": "string (first_name + last_name)",
    "phone": "string",
    "email": "string",
    "whatsapp": "string (WP自定义字段，可选)",
    "address": "string (address_1 + address_2)",
    "city": "string",
    "country": "string (country code, 如 AE/TH)"
  },
  "items": [
    {
      "wp_product_id": "string",
      "wp_sku": "string",
      "product_code": "string (可选，如站点侧有映射)",
      "title": "string",
      "quantity": 1,
      "unit_price": 259.00
    }
  ],
  "payment_method": "cod",
  "items_subtotal": 658.00,
  "delivery_fee": 0.00,
  "order_total": 658.00,
  "currency": "AED",
  "attribution": {
    "referral_source": "string (如 Referral: Lwi.co，可选)",
    "device_type": "mobile | desktop | tablet (可选)",
    "session_page_views": 62
  },
  "customer_ip": "string (可选)",
  "source_domain": "string",
  "raw_data": {}
}
```

> `[v2]` 变更说明：新增 `customer.email`、`customer.whatsapp`、`customer.city`、`customer.country`、`wp_order_status`、`wp_sku`、`payment_method`、`attribution`、`customer_ip`；`total_amount` 拆分为 `items_subtotal` + `delivery_fee` + `order_total` 三段式。详见 `05-页面字段字典.md` §11.3。

### 4.2 订单查询

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| GET | `/api/v1/order/orders` | 订单列表（支持筛选、分页） | 页面 6 |
| GET | `/api/v1/order/orders/{id}` | 订单详情 | 页面 7 |

### 4.3 订单状态流转

| 方法 | 路径 | 说明 | 状态转换 |
|---|---|---|---|
| POST | `/api/v1/order/orders/{id}/submit` | 提交待审核 | T-O3: draft → pending_review |
| POST | `/api/v1/order/orders/{id}/claim` | 领取审核 | T-O4: pending_review → reviewing |
| POST | `/api/v1/order/orders/{id}/approve` | 审核通过 | T-O5: reviewing → pending_handover |
| POST | `/api/v1/order/orders/{id}/reject` | 驳回 | T-O6: reviewing → returned |
| POST | `/api/v1/order/orders/{id}/resubmit` | 补充后重新提交 | T-O7: returned → pending_review |
| POST | `/api/v1/order/orders/{id}/handover` | 交接 | T-O8: pending_handover → handed_over |
| POST | `/api/v1/order/orders/{id}/deliver` | 标记签收 | T-O9: handed_over → delivered |
| POST | `/api/v1/order/orders/{id}/refuse` | 标记拒收 | T-O10: handed_over → rejected |
| POST | `/api/v1/order/orders/{id}/settlement-confirm` | 结算确认 | T-O13: pending_settlement → closed |
| POST | `/api/v1/order/orders/{id}/exception` | 标记异常 | T-O14: any → exception |
| POST | `/api/v1/order/orders/{id}/resolve-exception` | 解除异常 | T-O15: exception → 异常前状态 |

> 补充说明：`T-O11: delivered → pending_settlement` 由订单达到可结算节点触发；`T-O12: rejected → pending_settlement` 由拒收任务关闭后触发，二者均不再表示为从 `delivered/rejected` 直接调用“关闭订单”。

审核通过请求体：

```json
{
  "fulfillment_route": "qr_warehouse | vip_warehouse | th_warehouse",
  "split_required": false,
  "note": "string"
}
```

交接请求体：

```json
{
  "handover_target": "string (货盘名称或仓库名称)",
  "fulfillment_route": "qr_warehouse | vip_warehouse | th_warehouse",
  "note": "string"
}
```

### 4.4 拆单

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/order/orders/{id}/split` | 执行拆单 `[补]` |
| GET | `/api/v1/order/orders/{id}/children` | 查询子订单列表 `[补]` |

拆单请求体：

```json
{
  "sub_orders": [
    {
      "supplier": "string",
      "items": [
        { "product_code": "string", "quantity": 1 }
      ],
      "fulfillment_route": "qr_warehouse | vip_warehouse | th_warehouse"
    }
  ]
}
```

### 4.5 拒收任务

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| GET | `/api/v1/order/rejection-tasks` | 拒收任务列表 | 页面 8 |
| GET | `/api/v1/order/rejection-tasks/{id}` | 拒收任务详情 | 页面 8 |
| POST | `/api/v1/order/rejection-tasks/{id}/process` | 标记处理中 | 页面 8 |
| POST | `/api/v1/order/rejection-tasks/{id}/settle` | 登记结算处理 | 页面 8 |
| POST | `/api/v1/order/rejection-tasks/{id}/close` | 关闭任务 | 页面 8 |
| PUT | `/api/v1/order/rejection-tasks/{id}/note` | 补充说明 | 页面 8 |

### 4.6 异常任务

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| GET | `/api/v1/order/exception-tasks` | 异常任务列表 | 页面 8 |
| GET | `/api/v1/order/exception-tasks/{id}` | 异常任务详情 | 页面 8 |
| POST | `/api/v1/order/exception-tasks/{id}/process` | 标记处理中 | 页面 8 |
| POST | `/api/v1/order/exception-tasks/{id}/close` | 关闭任务 | 页面 8 |

### 4.7 留痕查询

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/order/orders/{id}/audit-log` | 查询订单操作留痕 |

---

## 5. 跨模块 API

### 5.1 内部事件（模块间级联）

以下事件通过内部消息队列或同步调用触发，不暴露为外部 API：

| 事件 | 触发方 | 消费方 | 动作 |
|---|---|---|---|
| `product.suspended` | 商品模块 | 分销模块 | 取消该商品的 selected / pending_publish 关系 |
| `product.undistributable` | 商品模块 | 分销模块 | 同上 |
| `site.disabled` | 分销模块 | 分销模块 | 取消该站点下所有 pending_publish |
| `site.webhook_failed` | 分销模块 | 分销模块 | 标记该站点下 publishing 为 publish_failed |
| `selection.published` | 分销模块 | 订单模块 | 该站点可接收订单 |
| `order.rejected` | 订单模块 | 订单模块 | 自动创建拒收任务 |
| `rejection_task.closed` | 订单模块 | 订单模块 | 订单进入 pending_settlement |

### 5.2 供应商查询（跨模块引用）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/product/suppliers` | `[补]` 供应商列表（订单模块审核时引用） |
| GET | `/api/v1/product/suppliers/{id}` | `[补]` 供应商详情 |
| POST | `/api/v1/product/suppliers` | `[补]` 新增供应商 |
| PUT | `/api/v1/product/suppliers/{id}` | `[补]` 更新供应商 |

> 注意：当前方案未将供应商作为独立模块，供应商数据挂在商品模块下。如果后续供应商管理复杂度增加，可能需要独立为供应商模块。

供应商最小数据模型 `[补]`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| supplier_id | string | 系统生成 | 供应商唯一标识 |
| supplier_name | string | 是 | 供应商名称 |
| contact_name | string | 否 | 联系人姓名 |
| contact_phone | string | 否 | 联系电话 |
| supplier_type | enum | 是 | 货盘供应商 / 自营仓库 / 其他 |
| market | enum | 是 | UAE / TH / 通用 |
| status | enum | 是 | 启用 / 停用 |
| created_at | datetime | 系统生成 | 创建时间 |
| updated_at | datetime | 系统生成 | 最后更新时间 |

> 一期供应商维护入口建议：在商品详情页（页面 2）的"来源与身份区"中，供应商字段支持选择已有供应商或内联新建。不单独建设供应商管理页面。

---

## 6. 系统模块 API `[补]`

### 6.1 AI 供应商管理

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| GET | `/api/v1/system/ai-providers` | AI 供应商列表 | 页面 S1 |
| POST | `/api/v1/system/ai-providers` | 添加 AI 供应商 | 页面 S1 |
| GET | `/api/v1/system/ai-providers/{id}` | 供应商详情 | 页面 S1 |
| PUT | `/api/v1/system/ai-providers/{id}` | 更新供应商配置 | 页面 S1 |
| DELETE | `/api/v1/system/ai-providers/{id}` | 删除供应商（需先解除任务路由引用） | 页面 S1 |
| POST | `/api/v1/system/ai-providers/{id}/check` | 检查供应商连接 | 页面 S1 |
| POST | `/api/v1/system/ai-providers/{id}/fetch-models` | 自动获取供应商可用模型列表 | 页面 S1 |

添加供应商请求体：

```json
{
  "name": "string",
  "api_mode": "openai_compatible | custom",
  "api_key": "string",
  "api_host": "string (如 https://api.moonshot.cn/)",
  "api_path": "string (如 /chat/completions)",
  "models": [
    { "name": "string (如 moonshot-v1-8k)" }
  ]
}
```

### 6.2 AI 模型管理

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| GET | `/api/v1/system/ai-providers/{id}/models` | 供应商下的模型列表 | 页面 S1 |
| POST | `/api/v1/system/ai-providers/{id}/models` | 手动添加模型 | 页面 S1 |
| DELETE | `/api/v1/system/ai-providers/{id}/models/{model_id}` | 删除模型 | 页面 S1 |

### 6.3 任务路由配置

| 方法 | 路径 | 说明 | 页面 |
|---|---|---|---|
| GET | `/api/v1/system/ai-task-routes` | 查询全部任务路由配置 | 页面 S1 |
| PUT | `/api/v1/system/ai-task-routes` | 批量更新任务路由配置 | 页面 S1 |

任务路由请求体：

```json
{
  "routes": [
    {
      "task_type": "translate | optimize | normalize | ocr | image_enhance",
      "provider_id": "string",
      "model_id": "string"
    }
  ]
}
```

### 6.4 留痕查询

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/system/ai-config/audit-log` | 查询 AI 配置操作留痕 |

---

## 7. 待确认事项

> 以下事项已在 `08-技术选型与回滚方案.md` 中给出推荐方案（含约束条件和可替代方案），标记为已确认的表示推荐方案已采纳。

| 序号 | 事项 | 影响范围 | 状态 |
|---|---|---|---|
| 1 | WordPress 订单回传的认证方式 | 订单接入安全性 | ✅ HMAC-SHA256 签名验证 |
| 2 | AI 服务是自建还是调用第三方 API | AI 辅助 API 设计 | ✅ 多供应商路由 + AiService 抽象层，供应商/模型由页面 S1 配置（详见 §6） |
| 3 | 图片存储方案 | 素材处理 API | ✅ OSS + CDN |
| 4 | 批量操作的并发上限和超时策略 | 批量 API | ✅ 异步队列，50 条/批，详见技术选型文档 |
| 5 | 发布 webhook 推送给站点的数据格式 | 发布 API | ✅ WooCommerce Product API 兼容格式 |
| 6 | 订单回传 webhook 的数据格式 | 订单接入 API | ✅ WooCommerce Order Webhook 标准格式 |
| 7 | 是否需要 API 鉴权 | 全局 | ✅ JWT（内部用户）+ HMAC（webhook 端点） |
| 8 | 是否需要 API 版本管理策略 | 全局 | ✅ 保持 `/api/v1/` 前缀，一期不做复杂版本管理 |
| 9 | 供应商是否需要独立 CRUD API | 商品模块 | ✅ 已落实，商品模块下独立 CRUD + 页面 2 内联创建 |
