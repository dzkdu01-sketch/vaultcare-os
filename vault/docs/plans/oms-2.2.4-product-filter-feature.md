# OMS-2.2.4 加购筛选功能实现

> 版本：v1.0
> 时间：2026-03-05
> 执行人：AI Assistant

---

## 一、功能概述

为订单中心的"快捷录单"商品选择功能添加筛选能力，支持按品类、受众标签进行筛选，与搜索功能组合使用，快速定位目标商品。

---

## 二、实现内容

### 2.1 功能特性

**`ProductSearchSelect` 组件增强**
- 位置：`frontend/src/components/ProductSearchSelect.tsx`
- 新增筛选功能：
  - **品类筛选**：显示所有品类按钮，点击筛选
  - **受众标签筛选**：支持"她用"、"他用"、"情侣"多选
  - **筛选状态显示**：筛选按钮显示激活状态和筛选数量
  - **清除筛选**：一键清除所有筛选条件
  - **结果计数**：显示当前筛选结果数量

### 2.2 筛选逻辑

**品类筛选**
- 从商品列表中自动提取所有品类
- 点击品类按钮进行筛选
- 再次点击"全部"按钮清除品类筛选

**受众标签筛选**
- 支持多选（取交集）
- 点击标签按钮切换选中状态
- 多选时只显示同时包含所有选中标签的商品

**组合筛选**
- 搜索 + 品类 + 标签 可以组合使用
- 筛选结果实时更新
- 显示当前匹配的商品数量

---

## 三、UI 设计

### 3.1 筛选按钮

```
┌─────────────────────────────────────┐
│ [🔍 搜索框]                         │
├─────────────────────────────────────┤
│ [🔎 筛选!] [清除] 找到 15 个商品    │
│                                     │
│ ▼ 筛选面板                          │
│ ┌─────────────────────────────────┐ │
│ │ 品类                            │ │
│ │ [全部] [跳蛋] [按摩棒] [...]    │ │
│ │                                 │ │
│ │ 受众标签                        │ │
│ │ [她用 ✓] [他用] [情侣]          │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ 商品列表...                         │
└─────────────────────────────────────┘
```

### 3.2 状态样式

| 状态 | 样式 |
|------|------|
| 未激活 | 灰色边框，白色背景 |
| 已激活 | 蓝色边框，蓝色背景，蓝色文字 |
| 有筛选 | 筛选按钮显示蓝色感叹号徽章 |

---

## 四、技术实现

### 4.1 筛选状态管理

```typescript
const [selectedCategory, setSelectedCategory] = useState<string>('')
const [selectedAudienceTags, setSelectedAudienceTags] = useState<AudienceTag[]>([])
```

### 4.2 过滤逻辑

```typescript
const filteredProducts = useMemo(() => {
  let result = products

  // 搜索过滤
  if (search.trim()) {
    const query = search.toLowerCase().trim()
    result = result.filter((p) => {
      const matchCode = p.master_code?.toLowerCase().includes(query)
      const matchTitleEn = p.title_en?.toLowerCase().includes(query)
      const matchTitleAr = p.title_ar?.toLowerCase().includes(query)
      return matchCode || matchTitleEn || matchTitleAr
    })
  }

  // 品类筛选
  if (selectedCategory) {
    result = result.filter((p) => {
      const catId = p.primary_category?.toString() ?? 'uncategorized'
      return catId === selectedCategory
    })
  }

  // 受众标签筛选（多选，取交集）
  if (selectedAudienceTags.length > 0) {
    result = result.filter((p) => {
      const tags = p.audience_tags ?? []
      return selectedAudienceTags.every((tag) => tags.includes(tag))
    })
  }

  return result.slice(0, 50)
}, [products, search, selectedCategory, selectedAudienceTags])
```

### 4.3 标签类型定义

```typescript
type AudienceTag = 'for_her' | 'for_him' | 'couple'
const AUDIENCE_TAG_LABELS: Record<AudienceTag, string> = {
  for_her: '她用',
  for_him: '他用',
  couple: '情侣',
}
```

---

## 五、使用说明

### 5.1 快捷录单筛选流程

1. 点击"快捷录单"或"新建订单"按钮
2. 选择分销商
3. 填写客户信息
4. **商品选择与筛选**：
   - 点击商品选择框，弹出搜索下拉框
   - 点击"筛选"按钮展开筛选面板
   - 选择品类（可选）
   - 选择受众标签（可选，可多选）
   - 输入搜索关键词（可选）
   - 查看筛选结果数量
   - 从结果中选择商品
5. 输入数量
6. 提交订单

### 5.2 筛选组合示例

| 场景 | 操作 | 结果 |
|------|------|------|
| 找她用商品 | 选择"她用"标签 | 只显示适合女性的商品 |
| 找情侣用品 | 选择"情侣"标签 | 只显示情侣商品 |
| 找她用跳蛋 | 选择"她用" + 选择"跳蛋"品类 | 只显示女性用跳蛋 |
| 找她用 vibr 开头 | 选择"她用" + 搜索"vibr" | 只显示女性用振动类商品 |

---

## 六、测试验证

### 6.1 功能测试项

| 测试项 | 操作步骤 | 预期结果 | 状态 |
|--------|----------|----------|------|
| 品类筛选 | 点击品类按钮 | 只显示该品类商品 | ☐ |
| 标签单选 | 点击"她用" | 只显示她用商品 | ☐ |
| 标签多选 | 点击"她用"+"情侣" | 只显示同时包含两个标签的商品 | ☐ |
| 组合筛选 | 选择品类 + 标签 + 搜索 | 显示同时满足所有条件的商品 | ☐ |
| 清除筛选 | 点击"清除"按钮 | 所有筛选条件被清除 | ☐ |
| 结果计数 | 应用筛选 | 显示正确的匹配数量 | ☐ |
| 无结果提示 | 应用无匹配筛选 | 显示"没有匹配筛选条件的商品" | ☐ |

### 6.2 构建验证

```bash
cd D:\cursor\vault\frontend
npm run build
```

预期结果：TypeScript 编译通过，无错误

---

## 七、与 OMS-2.2.3 的关系

OMS-2.2.3 和 OMS-2.2.4 共同构成了完整的商品快速选择能力：

| 功能 | OMS-2.2.3 | OMS-2.2.4 |
|------|-----------|-----------|
| 名称 | 加购快速搜索 | 加购筛选 |
| 能力 | 文本搜索 | 条件筛选 |
| 维度 | SKU 编码、商品名称 | 品类、受众标签 |
| 交互 | 搜索框输入 | 按钮点击选择 |
| 关系 | 可独立使用 | 可与搜索组合使用 |

---

## 八、后续优化建议

### 8.1 短期优化

1. **运营标签筛选**：支持按运营标签筛选
2. **价格区间筛选**：添加价格范围筛选
3. **供应商筛选**：按供应商筛选商品

### 8.2 中期优化

1. **筛选偏好记忆**：记住用户常用的筛选条件
2. **智能排序**：按销量/频率智能排序筛选结果
3. **筛选预设**：提供常用筛选组合的快捷按钮

---

## 九、相关文档

- 母表：`docs/quality/system-functional-matrix.md` - OMS-2.2.4
- 组件代码：`frontend/src/components/ProductSearchSelect.tsx`
- 类型定义：`frontend/src/types/index.ts`

---

## 十、代码位置

| 文件 | 路径 |
|------|------|
| 搜索筛选组件 | `frontend/src/components/ProductSearchSelect.tsx` |
| 订单页面 | `frontend/src/pages/OrdersPage.tsx` |
| 类型定义 | `frontend/src/types/index.ts` |
