import { useEffect, useMemo, useRef, useState } from 'react'
import { supplierApi, productApi } from '../../services/app-services'
import type { Supplier, SupplierInput, Product, ImportedSupplierProduct, SupplierProductImportResult } from '../../services/types'

type EditingCell = { id: number; field: string } | null

type ImportFilters = {
  supplier_id: string
  mapped: 'yes' | 'no' | 'all'
  keyword: string
}

export function SupplierPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [importedProducts, setImportedProducts] = useState<ImportedSupplierProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ImportFilters>({ supplier_id: '', mapped: 'no', keyword: '' })
  const [selectedImportedIds, setSelectedImportedIds] = useState<Set<number>>(new Set())
  const [batchUpdating, setBatchUpdating] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [showBindModal, setShowBindModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<SupplierProductImportResult | null>(null)

  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const [supplierForm, setSupplierForm] = useState<SupplierInput>({ name: '', code_prefix: '', contact: '', note: '' })

  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [sups, data, productData] = await Promise.all([
        supplierApi.list(),
        supplierApi.getImportedProducts(filters),
        productApi.list({ page_size: 999 }),
      ])
      setSuppliers(sups)
      setImportedProducts(data)
      setProducts(productData.items)
    } catch (err: any) {
      alert(`加载失败: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [filters.supplier_id, filters.mapped])
  useEffect(() => { if (editingCell && inputRef.current) inputRef.current.focus() }, [editingCell])

  const filteredImportedProducts = useMemo(() => {
    const kw = filters.keyword.trim().toLowerCase()
    if (!kw) return importedProducts
    return importedProducts.filter(item =>
      item.supplier_code.toLowerCase().includes(kw) ||
      item.product_name.toLowerCase().includes(kw) ||
      item.mapped_product_sku?.toLowerCase().includes(kw) ||
      item.mapped_product_name?.toLowerCase().includes(kw)
    )
  }, [filters.keyword, importedProducts])

  const openAddSupplier = () => {
    setEditingSupplierId(null)
    setSupplierForm({ name: '', code_prefix: '', contact: '', note: '' })
    setShowSupplierForm(true)
  }

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplierId(s.id)
    setSupplierForm({ name: s.name, code_prefix: s.code_prefix, contact: s.contact, note: s.note })
    setShowSupplierForm(true)
  }

  const saveSupplier = async () => {
    if (!supplierForm.name) return
    if (editingSupplierId) await supplierApi.update(editingSupplierId, supplierForm)
    else await supplierApi.create(supplierForm)
    setShowSupplierForm(false)
    await loadData()
  }

  const deleteSupplier = async (id: string) => {
    if (!confirm('删除供应商将同时删除其导入商品与映射数据，确定？')) return
    await supplierApi.remove(id)
    await loadData()
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const result = await supplierApi.importProducts(file)
      setImportResult(result)
      setSelectedImportedIds(new Set())
      await loadData()
    } catch (err: any) {
      setImportResult(null)
      alert(`导入失败: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const allSelected = filteredImportedProducts.length > 0 && filteredImportedProducts.every(item => selectedImportedIds.has(item.id))
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedImportedIds(new Set())
    } else {
      setSelectedImportedIds(new Set(filteredImportedProducts.map(item => item.id)))
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedImportedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBatchBind = async () => {
    if (selectedImportedIds.size === 0 || !selectedProductId) return
    setBatchUpdating(true)
    try {
      await supplierApi.batchBindImportedProducts({ supplier_product_ids: Array.from(selectedImportedIds), product_id: selectedProductId })
      setShowBindModal(false)
      setSelectedProductId('')
      setSelectedImportedIds(new Set())
      await loadData()
    } catch (err: any) {
      alert(`批量绑定失败: ${err.message}`)
    } finally {
      setBatchUpdating(false)
    }
  }

  const handleBatchUnbind = async () => {
    if (selectedImportedIds.size === 0) return
    setBatchUpdating(true)
    try {
      await supplierApi.batchUnbindImportedProducts(Array.from(selectedImportedIds))
      setSelectedImportedIds(new Set())
      await loadData()
    } catch (err: any) {
      alert(`批量解绑失败: ${err.message}`)
    } finally {
      setBatchUpdating(false)
    }
  }

  const handleSingleBind = async (row: ImportedSupplierProduct) => {
    setSelectedImportedIds(new Set([row.id]))
    setSelectedProductId(row.mapped_product_id || '')
    setShowBindModal(true)
  }

  const handleSingleUnbind = async (row: ImportedSupplierProduct) => {
    await supplierApi.batchUnbindImportedProducts([row.id])
    await loadData()
  }

  const startEdit = (row: ImportedSupplierProduct, field: string) => {
    setEditingCell({ id: row.id, field })
    if (field === 'cost_price_aed') setEditValue(String(row.cost_price_aed ?? ''))
  }

  const saveEdit = async () => {
    if (!editingCell) return
    const row = importedProducts.find(item => item.id === editingCell.id)
    if (!row) {
      setEditingCell(null)
      return
    }
    setEditingCell(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit()
    else if (e.key === 'Escape') setEditingCell(null)
  }

  const isEditing = (id: number, field: string) => editingCell?.id === id && editingCell?.field === field

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900">供应商</h2>
          <button onClick={openAddSupplier} className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700">
            添加供应商
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">名称</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-28">编码前缀</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">联系方式</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">备注</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600 w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">暂无供应商</td></tr>
              ) : suppliers.map(s => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2 text-slate-900 font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-slate-500 font-mono text-xs">{s.code_prefix || '-'}</td>
                  <td className="px-4 py-2 text-slate-600">{s.contact || '-'}</td>
                  <td className="px-4 py-2 text-slate-400 text-xs">{s.note || '-'}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => openEditSupplier(s)} className="text-violet-600 hover:text-violet-800 mr-2">编辑</button>
                    <button onClick={() => deleteSupplier(s.id)} className="text-red-500 hover:text-red-700">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">供应商商品映射工作台</h2>
            <p className="text-sm text-slate-500 mt-1">导入 Excel 后生成供应商商品记录，并在此批量绑定或解绑内部商品。</p>
          </div>
          <label className="px-3 py-1.5 text-sm border border-violet-200 text-violet-600 rounded-md hover:bg-violet-50 cursor-pointer">
            {uploading ? '导入中...' : '导入供应商商品'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
                e.currentTarget.value = ''
              }}
            />
          </label>
        </div>

        <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          Excel 固定列：供应商名称 / 供应商编码 / 商品名称 / 供货价（AED）
        </div>

        {importResult && (
          <div className="border border-slate-200 rounded-md px-3 py-3 text-sm space-y-2">
            <div className="text-slate-700">
              导入完成：共 {importResult.total} 行，新建 {importResult.created}，更新 {importResult.updated}，失败 {importResult.failed}
            </div>
            {importResult.rowErrors.length > 0 && (
              <div className="max-h-32 overflow-auto text-xs text-red-600 space-y-1">
                {importResult.rowErrors.map(err => (
                  <div key={`${err.row}-${err.message}`}>第 {err.row} 行：{err.message}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={filters.supplier_id}
            onChange={e => setFilters(prev => ({ ...prev, supplier_id: e.target.value }))}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">全部供应商</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={filters.mapped}
            onChange={e => setFilters(prev => ({ ...prev, mapped: e.target.value as ImportFilters['mapped'] }))}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="no">未映射</option>
            <option value="yes">已映射</option>
            <option value="all">全部状态</option>
          </select>
          <input
            value={filters.keyword}
            onChange={e => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
            placeholder="搜索供应商编码 / 商品名称 / 内部编码"
            className="px-3 py-2 border border-slate-300 rounded-md text-sm w-80"
          />
          <button onClick={loadData} className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">刷新</button>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={() => toggleSelectAll()} className="rounded border-slate-300" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">供应商</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">供应商编码</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">商品名称</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">供货价 (AED)</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">已绑定内部商品</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">加载中...</td></tr>
              ) : filteredImportedProducts.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">暂无供应商商品记录</td></tr>
              ) : filteredImportedProducts.map(row => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={selectedImportedIds.has(row.id)} onChange={() => toggleSelect(row.id)} className="rounded border-slate-300" />
                  </td>
                  <td className="px-4 py-2 text-slate-700">{row.supplier_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.supplier_code}</td>
                  <td className="px-4 py-2 text-slate-700">{row.product_name}</td>
                  <td className="px-4 py-2 text-right text-slate-700">
                    {isEditing(row.id, 'cost_price_aed') ? (
                      <input
                        ref={inputRef}
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={handleKeyDown}
                        className="w-24 px-2 py-1 border border-violet-300 rounded text-sm text-right"
                      />
                    ) : (
                      <span onClick={() => startEdit(row, 'cost_price_aed')} className="cursor-pointer hover:text-violet-600">
                        {row.cost_price_aed != null ? row.cost_price_aed : '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {row.mapped_product_sku ? `${row.mapped_product_sku} · ${row.mapped_product_name}` : '未绑定'}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => handleSingleBind(row)} className="text-violet-600 hover:text-violet-800 mr-2">绑定</button>
                    {row.mapped_product_id && (
                      <button onClick={() => handleSingleUnbind(row)} className="text-red-500 hover:text-red-700">解绑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedImportedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-lg shadow-lg px-6 py-3 flex items-center gap-4 z-50">
          <span className="text-sm text-slate-600">已选 {selectedImportedIds.size} 项</span>
          <button onClick={() => setShowBindModal(true)} disabled={batchUpdating} className="px-4 py-1.5 text-sm bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50">
            批量绑定
          </button>
          <button onClick={handleBatchUnbind} disabled={batchUpdating} className="px-4 py-1.5 text-sm bg-slate-500 text-white rounded hover:bg-slate-600 disabled:opacity-50">
            批量解绑
          </button>
          <button onClick={() => setSelectedImportedIds(new Set())} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700">
            取消
          </button>
        </div>
      )}

      {showBindModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowBindModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 w-[480px] space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-medium text-slate-900">批量绑定内部商品</h3>
            <p className="text-sm text-slate-500">已选择 {selectedImportedIds.size} 条供应商商品，请选择一个内部商品进行绑定。</p>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">请选择内部商品</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowBindModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">取消</button>
              <button onClick={handleBatchBind} disabled={!selectedProductId || batchUpdating} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50">确认绑定</button>
            </div>
          </div>
        </div>
      )}

      {showSupplierForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowSupplierForm(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 w-[420px] space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-medium text-slate-900">{editingSupplierId ? '编辑供应商' : '添加供应商'}</h3>
            <input
              value={supplierForm.name}
              onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))}
              placeholder="供应商名称 *"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <input
              value={supplierForm.code_prefix}
              onChange={e => setSupplierForm(p => ({ ...p, code_prefix: e.target.value }))}
              placeholder="编码前缀（如 VIP）"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <input
              value={supplierForm.contact}
              onChange={e => setSupplierForm(p => ({ ...p, contact: e.target.value }))}
              placeholder="联系方式"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <input
              value={supplierForm.note}
              onChange={e => setSupplierForm(p => ({ ...p, note: e.target.value }))}
              placeholder="备注"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowSupplierForm(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">取消</button>
              <button onClick={saveSupplier} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
