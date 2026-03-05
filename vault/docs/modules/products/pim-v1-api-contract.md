# PIM v1 API Contract (Draft)

> 来源：2026-03-04 圆桌决议（ERP 总体 + 商品模块）  
> 状态：可用于 `/开发` 直接实现  
> 适用范围：`MasterSKU + SiteListing + WPSyncMapping`

---

## 1. 决议前提（强约束）

1. `master_code` 为唯一跨系统业务主键，**不可变**。  
2. 当前 7 个分销站点均支持 `站点覆盖价`。  
3. 审核拒绝后允许修改并再次提交审核。  
4. 推送失败重试上限为 `3` 次。  
5. 采用三层模型作为目标态与 MVP 基线：`MasterSKU` / `SiteListing` / `WPSyncMapping`。

---

## 2. 通用约定

- Base URL: `/api/v1/pim`
- Auth: `Authorization: Bearer <token>`
- 时间：ISO8601 UTC
- 金额：AED，`number`（两位小数）
- 建议 Header：`Idempotency-Key`（推送类接口）

统一错误体：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "master_code is immutable",
    "details": {
      "field": "master_code"
    },
    "request_id": "req_01J..."
  }
}
```

---

## 3. 资源模型（v1 最小字段）

### 3.1 MasterSKU

```json
{
  "master_code": "VC462",
  "title": "VC462 Rechargeable Dual-Ended Electric Male Masturbator",
  "short_description": "Material: TPE + ABS...",
  "description": "<p>...</p>",
  "primary_category": "Masturbators",
  "secondary_categories": ["Sexual Wellness"],
  "tags": ["For him", "high value"],
  "image_urls": [
    "https://cdn.example.com/1.jpg",
    "https://cdn.example.com/2.jpg"
  ],
  "video_urls": [
    "https://cdn.example.com/demo.mp4"
  ],
  "product_type": "simple",
  "review_status": "draft",
  "created_at": "2026-03-04T10:00:00Z",
  "updated_at": "2026-03-04T10:05:00Z"
}
```

### 3.2 SiteListing

```json
{
  "master_code": "VC462",
  "site_id": "site_uae_01",
  "site_regular_price": 229.0,
  "site_sale_price": 199.0,
  "override_price_enabled": true,
  "publish_status": "not_pushed",
  "visibility": "visible",
  "in_stock": true,
  "stock_qty": null,
  "updated_at": "2026-03-04T10:06:00Z"
}
```

### 3.3 WPSyncMapping

```json
{
  "mapping_id": "map_01J...",
  "master_code": "VC462",
  "site_id": "site_uae_01",
  "remote_product_id": 5407,
  "sync_status": "success",
  "retry_count": 1,
  "last_error": null,
  "payload_hash": "sha256:...",
  "last_synced_at": "2026-03-04T10:10:00Z"
}
```

---

## 4. API 契约（请求/响应）

### 4.1 创建主商品

`POST /api/v1/pim/master-skus`

```json
{
  "master_code": "VC462",
  "title": "VC462 Rechargeable Dual-Ended Electric Male Masturbator",
  "short_description": "Material: TPE + ABS...",
  "description": "<p>...</p>",
  "primary_category": "Masturbators",
  "secondary_categories": [],
  "tags": ["For him"],
  "image_urls": ["https://cdn.example.com/1.jpg"],
  "video_urls": ["https://cdn.example.com/demo.mp4"],
  "product_type": "simple"
}
```

响应 `201`：

```json
{
  "data": {
    "master_code": "VC462",
    "review_status": "draft",
    "created_at": "2026-03-04T10:00:00Z"
  }
}
```

### 4.2 更新主商品（禁止修改 master_code）

`PATCH /api/v1/pim/master-skus/{master_code}`

```json
{
  "title": "VC462 Rechargeable Dual-Ended Electric Male Masturbator V2",
  "tags": ["For him", "high value"]
}
```

响应 `200`：

```json
{
  "data": {
    "master_code": "VC462",
    "updated_at": "2026-03-04T10:12:00Z"
  }
}
```

### 4.3 提交审核

`POST /api/v1/pim/master-skus/{master_code}/submit-review`

```json
{
  "note": "ready for review"
}
```

响应 `200`：

```json
{
  "data": {
    "master_code": "VC462",
    "review_status": "pending_review"
  }
}
```

### 4.4 审核决策（审核员）

`POST /api/v1/pim/master-skus/{master_code}/review-decisions`

通过：

```json
{
  "decision": "approve",
  "comment": "ok"
}
```

拒绝：

```json
{
  "decision": "reject",
  "comment": "missing category mapping"
}
```

响应 `200`：

```json
{
  "data": {
    "master_code": "VC462",
    "review_status": "approved",
    "reviewed_by": "user_reviewer_01",
    "reviewed_at": "2026-03-04T10:20:00Z"
  }
}
```

### 4.5 站点商品配置（覆盖价）

`PUT /api/v1/pim/master-skus/{master_code}/site-listings/{site_id}`

```json
{
  "site_regular_price": 229.0,
  "site_sale_price": 199.0,
  "override_price_enabled": true,
  "visibility": "visible",
  "in_stock": true
}
```

响应 `200`：

```json
{
  "data": {
    "master_code": "VC462",
    "site_id": "site_uae_01",
    "publish_status": "not_pushed"
  }
}
```

### 4.6 发起推送任务（批量）

`POST /api/v1/pim/sync/jobs`

```json
{
  "master_codes": ["VC462", "VC431"],
  "site_ids": ["site_uae_01", "site_uae_02"],
  "force": false,
  "dry_run": false
}
```

响应 `202`：

```json
{
  "data": {
    "job_id": "job_01J...",
    "status": "queued",
    "total_items": 4
  }
}
```

### 4.7 查询推送任务

`GET /api/v1/pim/sync/jobs/{job_id}`

```json
{
  "data": {
    "job_id": "job_01J...",
    "status": "running",
    "summary": {
      "total": 4,
      "success": 2,
      "failed": 1,
      "syncing": 1
    },
    "items": [
      {
        "mapping_id": "map_01J...",
        "master_code": "VC462",
        "site_id": "site_uae_01",
        "sync_status": "failed",
        "retry_count": 1,
        "last_error": "WC_API_TIMEOUT"
      }
    ]
  }
}
```

### 4.8 重试失败映射（上限 3）

`POST /api/v1/pim/sync/mappings/{mapping_id}/retry`

```json
{
  "reason": "manual_retry"
}
```

响应 `200`：

```json
{
  "data": {
    "mapping_id": "map_01J...",
    "sync_status": "retrying",
    "retry_count": 2,
    "retry_limit": 3
  }
}
```

### 4.9 异常队列（老板处理）

`GET /api/v1/pim/exceptions?owner=owner_boss&status=open`

```json
{
  "data": [
    {
      "exception_id": "ex_01J...",
      "type": "SYNC_FAILED",
      "master_code": "VC462",
      "site_id": "site_uae_01",
      "owner": "owner_boss",
      "status": "open",
      "reason": "RETRY_LIMIT_REACHED",
      "created_at": "2026-03-04T10:40:00Z"
    }
  ]
}
```

---

## 5. 枚举定义（v1）

- `review_status`: `draft | pending_review | approved | rejected`
- `publish_status`: `not_pushed | pushed | unpublished`
- `sync_status`: `pending | syncing | success | failed | retrying`
- `visibility`: `visible | hidden`
- `decision`: `approve | reject`

---

## 6. /开发执行清单（可直接开工）

### 6.1 后端优先级（建议顺序）

1. 数据模型与迁移：`MasterSKU`/`SiteListing`/`WPSyncMapping`  
2. 审核流 API：创建、更新、提交审核、审核决策  
3. 站点配置 API：覆盖价与发布属性写入  
4. 推送作业 API：`sync/jobs` + `sync/jobs/{id}`  
5. 重试与异常队列：重试上限、异常归老板  
6. 幂等与审计：`payload_hash`、操作日志、错误码标准化  

### 6.2 前端联调顺序（建议）

1. 商品建档页（最小字段）  
2. 审核看板（待审/通过/拒绝）  
3. 站点配置页（7 站点覆盖价）  
4. 推送任务页（状态汇总 + 单项错误）  
5. 异常队列页（老板处理）  

### 6.3 验收（DoD）最小条目

- `master_code` 不可变校验生效  
- 拒审后可修改并再次提交  
- 7 站点均可设置覆盖价  
- 推送失败重试上限 3 次生效  
- 超限失败进入老板异常队列  

---

## 7. 审核员工作台前端映射（AI 辅助上新 100 品）

### 7.1 页面与组件清单（React）

- `ReviewWorkbenchPage`：三栏工作台容器，挂载全局快捷键
- `BatchActionBar`：批量应用分类/标签/价格策略、批量提交
- `ReviewQueuePanel`：待审核队列（批次、风险标签、处理状态）
- `QueueItemCard`：单条卡片（缺图/低置信/疑似水印）
- `ProductFormPanel`：核心字段编辑（标题、分类、标签、价格、短描、图片）
- `AIAssistInlineActions`：就地 AI 按钮（优化标题、卖点提炼、竞品链接填充、一键补全）
- `AssetPreviewPanel`：主图/详情图预览、质量评分、问题清单
- `QualityIssueList`：`pass / auto-fixed / manual-required` 状态分层
- `ReviewFooterHotkeys`：快捷键说明（A/R/S/N/P）
- `ExceptionDrawer`：业务化错误与可执行动作

### 7.2 前端状态模型（最小）

```json
{
  "selectedItemId": "item_01",
  "queueFilters": {
    "batch_id": "batch_20260304_01",
    "risk": ["low_confidence", "watermark"],
    "status": ["pending"]
  },
  "draftForm": {},
  "aiSuggestion": {
    "fields": {},
    "confidence_by_field": {}
  },
  "assetQuality": {
    "score": 85,
    "issues": ["size_inconsistent"],
    "status": "auto-fixed"
  },
  "pendingActions": {
    "save": false,
    "submit": false,
    "bulk_apply": false
  },
  "hotkeyEnabled": true
}
```

### 7.3 组件到 API 的调用映射

| 组件/动作 | API | 说明 |
|---|---|---|
| 队列加载 | `GET /api/v1/pim/review-items?status=pending&batch_id=...` | 拉取待审核任务 |
| 单条详情初始化 | `GET /api/v1/pim/master-skus/{master_code}` | 拉主商品 |
| 站点配置初始化 | `GET /api/v1/pim/master-skus/{master_code}/site-listings` | 拉 7 站点配置 |
| 保存编辑 | `PATCH /api/v1/pim/master-skus/{master_code}` | 保存主字段 |
| 保存站点项 | `PUT /api/v1/pim/master-skus/{master_code}/site-listings/{site_id}` | 保存覆盖价与发布属性 |
| 提交审核 | `POST /api/v1/pim/master-skus/{master_code}/submit-review` | 进入待审核 |
| 审核通过/拒绝 | `POST /api/v1/pim/master-skus/{master_code}/review-decisions` | 审核员决策 |
| 批量提交 | `POST /api/v1/pim/review-items/bulk-submit` | 批量推进状态 |
| 批量应用策略 | `POST /api/v1/pim/review-items/bulk-apply` | 批量分类/标签/价格 |
| 发起推送 | `POST /api/v1/pim/sync/jobs` | 审核后批量推送 |
| 查询推送任务 | `GET /api/v1/pim/sync/jobs/{job_id}` | 状态回写 |
| 异常队列 | `GET /api/v1/pim/exceptions?owner=owner_boss&status=open` | 老板处理 |

### 7.4 AI 辅助与素材治理扩展接口（新增）

| 功能 | API | 返回核心字段 |
|---|---|---|
| 优化标题 | `POST /api/v1/pim/ai/optimize-title` | `title`, `confidence` |
| 卖点提炼 | `POST /api/v1/pim/ai/extract-selling-points` | `selling_points[]`, `confidence` |
| 竞品链接填充 | `POST /api/v1/pim/ai/fill-from-competitor-url` | `suggested_fields`, `warnings[]` |
| 一键补全字段 | `POST /api/v1/pim/ai/autofill-fields` | `suggested_fields`, `confidence_by_field` |
| 图片质量检测 | `POST /api/v1/pim/assets/quality-check` | `score`, `issues[]`, `status` |
| 图片标准化 | `POST /api/v1/pim/assets/normalize` | `normalized_urls[]`, `status` |

### 7.5 分阶段实施建议（两周）

1. **阶段 1（先可用）**：队列 + 表单保存 + 审核决策 + 快捷键  
2. **阶段 2（提效率）**：批量操作条 + 就地 AI（优化标题/卖点）  
3. **阶段 3（提质量）**：竞品链接填充 + 图片质量检测/标准化  
4. **阶段 4（闭环）**：推送任务联动 + 异常队列打通  

---

## 8. 竞品链接填充接口契约（细化）

### 8.1 目标接口

`POST /api/v1/pim/ai/fill-from-competitor-url`

请求体：

```json
{
  "master_code": "VC462",
  "competitor_url": "https://example.com/product/xxx",
  "target_site_id": "site_uae_01",
  "fill_mode": "suggest_only"
}
```

响应体：

```json
{
  "data": {
    "source": {
      "url": "https://example.com/product/xxx",
      "domain": "example.com",
      "fetched_at": "2026-03-04T12:00:00Z"
    },
    "suggested_fields": {
      "title": "...",
      "short_description": "...",
      "description": "...",
      "primary_category_suggestion": "Masturbators",
      "tags_suggestion": ["For him"],
      "regular_price_suggestion": 229.0,
      "sale_price_suggestion": 199.0,
      "image_urls": ["https://cdn.example.com/p1.jpg"],
      "video_urls": []
    },
    "confidence_by_field": {
      "title": 0.91,
      "primary_category_suggestion": 0.76,
      "regular_price_suggestion": 0.88
    },
    "warnings": [
      "suspected_watermark",
      "category_low_confidence"
    ],
    "blocked_fields": [
      "master_code"
    ]
  }
}
```

### 8.2 后端处理规则

1. URL 安全校验（只允许 `http/https`，禁止内网地址）  
2. 抓取优先级：`JSON-LD > Meta > DOM fallback`  
3. 输出字段只允许白名单字段，系统字段统一阻断  
4. 所有建议字段附带置信度，供前端分级展示  
5. 同 URL 24 小时缓存，减少重复抓取成本  

### 8.3 置信度阈值

- `>=0.85`：可一键采纳
- `0.70-0.84`：需人工复核
- `<0.70`：仅参考

### 8.4 错误码

- `INVALID_URL`
- `URL_BLOCKED`
- `FETCH_TIMEOUT`
- `PARSE_FAILED`
- `LOW_CONFIDENCE_ONLY`
- `FIELD_BLOCKED`
- `RATE_LIMITED`
