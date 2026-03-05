# OMS-2.2.3 加购快速搜索功能实现

> 版本：v1.0
> 时间：2026-03-05
> 执行人：AI Assistant

---

## 一、功能概述

为订单中心的"快捷录单"功能添加商品快速搜索能力，支持按 SKU 编码、商品名称（英文/阿拉伯语）进行搜索，提升录单效率。

---

## 二、实现内容

### 2.1 新增组件

**`ProductSearchSelect` 组件**
- 位置：`frontend/src/components/ProductSearchSelect.tsx`
- 功能：带搜索框的商品选择下拉组件
- 特性：
  - 支持按 `master_code`、`title_en`、`title_ar` 搜索
  - 显示商品库存状态（有货/缺货）
  - 显示商品售价
  - 已选商品可快速清除
  - 点击外部自动关闭下拉框
  - 限制最多显示 50 条结果

**`Popover` 组件**
- 位置：`frontend/src/components/ui/popover.tsx`
- 功能：基于 Radix UI 的 Popover 组件封装

### 2.2 修改文件

**`OrdersPage.tsx`**
- 位置：`frontend/src/pages/OrdersPage.tsx`
- 修改内容：
  - 导入 `ProductSearchSelect` 组件
  - 将商品明细选择从原生 `<select>` 替换为 `ProductSearchSelect`
  - 保留原有数量和单价输入框

---

## 三、使用说明

### 3.1 快捷录单流程

1. 点击"快捷录单"或"新建订单"按钮
2. 选择分销商
3. 填写客户信息（姓名、电话、地址、城市）
4. **商品选择**：
   - 点击商品选择框，弹出搜索下拉框
   - 输入关键词（SKU 编码或商品名称）
   - 从搜索结果中选择商品
   - 自动填充售价
   - 输入数量
   - 可添加多个商品
5. 填写备注
6. 提交订单

### 3.2 搜索功能

支持以下搜索方式：
- **SKU 编码**：输入 `vc-u-...` 或完整编码
- **英文商品名**：输入商品英文名称片段
- **阿拉伯语商品名**：输入阿拉伯语名称片段

搜索结果限制：
- 初始加载显示前 50 个商品
- 搜索时显示匹配的前 50 个结果
- 无匹配结果时显示提示

---

## 四、技术实现

### 4.1 组件接口

```typescript
interface ProductSearchSelectProps {
  products: MasterSKU[]      // 商品列表
  value: string              // 当前选中的商品 ID
  onChange: (skuId: string, product?: MasterSKU) => void  // 选择变化回调
  placeholder?: string       // 占位符文本
  disabled?: boolean         // 是否禁用
  showStock?: boolean        // 是否显示库存状态
}
```

### 4.2 搜索逻辑

```typescript
const filteredProducts = useMemo(() => {
  if (!search.trim()) return products.slice(0, 50)

  const query = search.toLowerCase().trim()
  return products
    .filter((p) => {
      const matchCode = p.master_code?.toLowerCase().includes(query)
      const matchTitleEn = p.title_en?.toLowerCase().includes(query)
      const matchTitleAr = p.title_ar?.toLowerCase().includes(query)
      return matchCode || matchTitleEn || matchTitleAr
    })
    .slice(0, 50)
}, [products, search])
```

### 4.3 交互特性

- **点击外部关闭**：使用 `mousedown` 事件监听，点击组件外部时自动关闭下拉框
- **自动聚焦**：打开下拉框后搜索框自动聚焦
- **快速清除**：已选商品右侧显示 X 按钮，点击可快速清除选择
- **选中高亮**：当前选中的商品在下拉框中高亮显示
- **价格自动填充**：选择商品后自动填充售价

---

## 五、测试验证

### 5.1 功能测试项

| 测试项 | 操作步骤 | 预期结果 | 状态 |
|--------|----------|----------|------|
| 搜索 SKU 编码 | 输入 `vc-u-` | 显示匹配的 SKU 列表 | ☐ |
| 搜索商品名 | 输入商品名片段 | 显示匹配的商品列表 | ☐ |
| 选择商品 | 点击搜索结果 | 商品被选中，售价自动填充 | ☐ |
| 清除选择 | 点击 X 按钮 | 选择被清除，可重新选择 | ☐ |
| 点击外部关闭 | 打开下拉后点击外部 | 下拉框关闭 | ☐ |
| 多商品添加 | 添加多个商品行 | 每行都可独立搜索选择 | ☐ |
| 库存状态显示 | 选择有货/缺货商品 | 显示对应状态标签 | ☐ |

### 5.2 构建验证

```bash
cd D:\cursor\vault\frontend
npm run build
```

预期结果：TypeScript 编译通过，无错误

---

## 六、后续优化建议

### 6.1 短期优化（W3 迭代）

1. **品类筛选**：在搜索结果上方添加品类筛选
2. **标签筛选**：支持按受众标签、运营标签筛选
3. **最近使用**：显示最近选择的商品
4. **快捷键支持**：支持键盘上下键选择商品

### 6.2 中期优化

1. **批量录入**：支持粘贴多个 SKU 快速加购
2. **扫码枪支持**：支持扫码枪输入 SKU
3. **智能排序**：根据销量/频率智能排序搜索结果

---

## 七、相关文档

- 母表：`docs/quality/system-functional-matrix.md` - OMS-2.2.3
- 测试剧本：`docs/test-scenarios/admin-ops.md`
- 类型定义：`frontend/src/types/index.ts`

---

## 八、代码位置

| 文件 | 路径 |
|------|------|
| 搜索组件 | `frontend/src/components/ProductSearchSelect.tsx` |
| Popover 组件 | `frontend/src/components/ui/popover.tsx` |
| 订单页面 | `frontend/src/pages/OrdersPage.tsx` |
