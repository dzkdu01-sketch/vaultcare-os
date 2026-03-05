# OMS-2.2.5 批量录入 SKU 功能实现

> 版本：v1.0
> 时间：2026-03-05
> 执行人：AI Assistant

---

## 一、功能概述

为订单中心的"快捷录单"功能添加批量录入能力，支持粘贴文本和扫码枪两种录入方式，大幅提升录单效率。

---

## 二、实现内容

### 2.1 新增组件

**`BulkEntryDialog` 组件**
- 位置：`frontend/src/components/BulkEntryDialog.tsx`
- 功能：批量录入 SKU 对话框
- 特性：
  - **粘贴录入模式**：粘贴多行 SKU 文本，自动解析
  - **扫码枪模式**：扫码枪连续扫描，自动添加
  - **默认数量设置**：可设置默认录入数量
  - **解析结果预览**：显示解析成功/失败明细
  - **错误提示**：未找到 SKU 时显示错误信息

### 2.2 支持格式

**粘贴录入格式**
```
# 格式 1：SKU 编码，数量（逗号分隔）
VC-U-001, 5
VC-U-002, 10

# 格式 2：SKU 编码 + 制表符 + 数量
VC-U-001	5
VC-U-002	10

# 格式 3：仅 SKU 编码（使用默认数量）
VC-U-001
VC-U-002
```

**扫码枪录入**
- 扫描 SKU 条码后自动添加
- 支持连续扫描
- 使用设置的默认数量

---

## 三、UI 设计

### 3.1 对话框布局

```
┌─────────────────────────────────────────────┐
│ 批量录入 SKU                                │
├─────────────────────────────────────────────┤
│ [📤 粘贴录入] [🔍 扫码枪录入]               │
├─────────────────────────────────────────────┤
│ 默认数量：[1]                               │
├─────────────────────────────────────────────┤
│ 粘贴 SKU 列表                               │
│ ┌─────────────────────────────────────────┐ │
│ │ VC-U-001, 5                             │ │
│ │ VC-U-002, 10                            │ │
│ │ VC-U-003                                │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ 解析结果预览                    ✓ 成功 2  ✗ 失败 1 │
│ ┌─────────────────────────────────────────┐ │
│ │ ✓ VC-U-001  商品名称     ×5  AED 100   │ │
│ │ ✓ VC-U-002  商品名称     ×10 AED 200   │ │
│ │ ✗ VC-U-999  未找到商品                  │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│          [取消]  [添加 2 个商品到订单]       │
└─────────────────────────────────────────────┘
```

### 3.2 扫码枪模式

```
┌─────────────────────────────────────────────┐
│ 批量录入 SKU                                │
├─────────────────────────────────────────────┤
│ [粘贴录入] [🔍 扫码枪录入]                  │
├─────────────────────────────────────────────┤
│ 默认数量：[1]                               │
├─────────────────────────────────────────────┤
│ 扫码枪输入                                  │
│ ┌─────────────────────────────────────────┐ │
│ │ 请使用扫码枪扫描商品条形码或 SKU 码...   │ │
│ │ （扫码后自动添加，支持连续扫描）        │ │
│ └─────────────────────────────────────────┘ │
│ 🔍 扫码枪扫描后会自动添加商品到订单        │
└─────────────────────────────────────────────┘
```

---

## 四、技术实现

### 4.1 SKU 解析逻辑

```typescript
const parseInput = () => {
  const lines = inputText.trim().split('\n').filter((line) => line.trim())
  const results: ParseResult[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    // 支持格式：SKU 编码，数量 或 SKU 编码
    const parts = trimmedLine.split(/[,，\t\s]+/).filter((p) => p.trim())
    const skuCode = parts[0]?.trim()
    const qty = parts[1] ? parseInt(parts[1]) : defaultQuantity

    if (!skuCode) continue

    const product = skuMap.get(skuCode.toLowerCase())

    if (!product) {
      results.push({
        sku_id: '',
        quantity: qty || 1,
        unit_price: '',
        error: `未找到商品：${skuCode}`,
      })
    } else {
      results.push({
        sku_id: product.id.toString(),
        quantity: qty || 1,
        unit_price: product.selling_price,
        product,
      })
    }
  }

  setParseResults(results)
}
```

### 4.2 扫码枪输入处理

```typescript
const handleScanInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const value = e.target.value
  setInputText(value)

  // 检测是否有回车（扫码枪输入结束）
  if (value.endsWith('\n')) {
    const lines = value.trim().split('\n')
    const lastLine = lines[lines.length - 1]?.trim()

    if (lastLine) {
      const product = skuMap.get(lastLine.toLowerCase())
      if (product) {
        // 直接添加到购物车
        onAddItems([
          {
            sku_id: product.id.toString(),
            quantity: defaultQuantity,
            unit_price: product.selling_price,
          },
        ])
        setInputText('')
        setParseResults([])
      }
    }
  }
}
```

### 4.3 SKU 映射

```typescript
const skuMap = useMemo(() => {
  const map = new Map<string, MasterSKU>()
  products.forEach((p) => {
    map.set(p.master_code.toLowerCase(), p)
    if (p.legacy_code) {
      map.set(p.legacy_code.toLowerCase(), p)
    }
  })
  return map
}, [products])
```

---

## 五、使用说明

### 5.1 粘贴录入流程

1. 点击"快捷录单"或"新建订单"按钮
2. 选择分销商，填写客户信息
3. 点击"批量录入"按钮
4. 选择"粘贴录入"模式
5. 设置默认数量（可选）
6. 粘贴 SKU 列表文本
7. 查看解析结果预览
8. 点击"添加 X 个商品到订单"

### 5.2 扫码枪录入流程

1. 点击"快捷录单"或"新建订单"按钮
2. 选择分销商，填写客户信息
3. 点击"批量录入"按钮
4. 选择"扫码枪录入"模式
5. 设置默认数量
6. 使用扫码枪扫描商品条码
7. 扫描后自动添加到订单
8. 支持连续扫描

### 5.3 输入格式示例

| 格式 | 示例 | 说明 |
|------|------|------|
| 逗号分隔 | `VC-U-001, 5` | SKU 编码 + 数量 |
| 制表符分隔 | `VC-U-001\t5` | SKU 编码 + Tab+ 数量 |
| 空格分隔 | `VC-U-001 5` | SKU 编码 + 空格 + 数量 |
| 仅 SKU | `VC-U-001` | 使用默认数量 |
| 旧编码 | `OLD-001, 3` | 支持 legacy_code |

---

## 六、测试验证

### 6.1 功能测试项

| 测试项 | 操作步骤 | 预期结果 | 状态 |
|--------|----------|----------|------|
| 粘贴录入 - 逗号分隔 | 粘贴 `VC-U-001, 5` | 正确解析 SKU 和数量 | ☐ |
| 粘贴录入 - 制表符 | 粘贴 `VC-U-001\t5` | 正确解析 SKU 和数量 | ☐ |
| 粘贴录入 - 仅 SKU | 粘贴 `VC-U-001` | 使用默认数量 | ☐ |
| 粘贴录入 - 旧编码 | 粘贴旧 SKU 编码 | 正确匹配商品 | ☐ |
| 错误处理 | 粘贴不存在的 SKU | 显示错误提示 | ☐ |
| 解析预览 | 粘贴多条数据 | 显示成功/失败明细 | ☐ |
| 扫码枪录入 | 扫描 SKU 条码 | 自动添加到订单 | ☐ |
| 连续扫描 | 连续扫描多个商品 | 逐个添加成功 | ☐ |
| 默认数量 | 修改默认数量 | 使用新数量添加 | ☐ |

### 6.2 构建验证

```bash
cd D:\cursor\vault\frontend
npm run build
```

预期结果：TypeScript 编译通过，无错误

---

## 七、与 OMS-2.2.3/2.2.4 的关系

OMS-2.2.3、OMS-2.2.4 和 OMS-2.2.5 共同构成了完整的商品快速录入能力：

| 功能 | OMS-2.2.3 | OMS-2.2.4 | OMS-2.2.5 |
|------|-----------|-----------|-----------|
| 名称 | 加购快速搜索 | 加购筛选 | 批量录入 |
| 能力 | 文本搜索 | 条件筛选 | 批量添加 |
| 场景 | 单个商品搜索 | 按条件筛选 | 批量/扫码录入 |
| 交互 | 搜索框输入 | 按钮点击 | 粘贴/扫码 |
| 效率 | 中等 | 中等 | 高 |

---

## 八、后续优化建议

### 8.1 短期优化

1. **历史记录**：记住常用 SKU 组合
2. **快速选择**：显示最近添加的商品
3. **数量快捷键**：扫码后数字键快速修改数量

### 8.2 中期优化

1. **Excel 导入**：支持 Excel 文件直接导入
2. **模板下载**：提供标准导入模板
3. **智能匹配**：模糊匹配 SKU 编码

---

## 九、相关文档

- 母表：`docs/quality/system-functional-matrix.md` - OMS-2.2.5
- 组件代码：`frontend/src/components/BulkEntryDialog.tsx`
- 集成页面：`frontend/src/pages/OrdersPage.tsx`

---

## 十、代码位置

| 文件 | 路径 |
|------|------|
| 批量录入组件 | `frontend/src/components/BulkEntryDialog.tsx` |
| 订单页面 | `frontend/src/pages/OrdersPage.tsx` |
| 搜索组件 | `frontend/src/components/ProductSearchSelect.tsx` |
