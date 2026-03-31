import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supplierApi } from '../../services/app-services'
import type { ImportedSupplierProduct, ProductSupplierMapping, Supplier } from '../../services/types'

type Props = {
  productId: string | undefined
  /** 外层已由分区卡片承载标题与边框时设为 true，避免重复标题与双层卡片 */
  embedded?: boolean
}

/** 编辑页：搜索已导入未映射的供应商商品并绑定到当前 product；已关联的供应商不再出现在可选列表（需先移除再换编码） */
export function SupplierCodeBindSection({ productId, embedded = false }: Props) {
  const [mappings, setMappings] = useState<ProductSupplierMapping[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [results, setResults] = useState<ImportedSupplierProduct[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [bindingId, setBindingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState({ supplier_id: '', supplier_code: '', cost_price: '' })
  const [addingManual, setAddingManual] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const loadMappings = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    setError('')
    try {
      const maps = await supplierApi.getMappings(productId)
      setMappings(maps)
    } catch (e: any) {
      setError(e?.message || '加载供应商关联失败')
      setMappings([])
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void loadMappings()
  }, [loadMappings])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await supplierApi.list()
        if (!cancelled) setSuppliers(list)
      } catch {
        if (!cancelled) setSuppliers([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const mappedSupplierIds = useMemo(() => new Set(mappings.map(m => m.supplier_id)), [mappings])

  useEffect(() => {
    if (!productId) return
    const q = keyword.trim()
    if (q.length < 1) {
      setResults([])
      setSearchLoading(false)
      return
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setSearchLoading(true)
        setError('')
        try {
          const rows = await supplierApi.getImportedProducts({
            mapped: 'no',
            keyword: q,
            supplier_id: supplierFilter || undefined,
          })
          setResults(rows.filter(r => !mappedSupplierIds.has(r.supplier_id)))
        } catch (e: any) {
          setError(e?.message || '搜索失败')
          setResults([])
        } finally {
          setSearchLoading(false)
        }
      })()
    }, 300)
    return () => window.clearTimeout(t)
  }, [keyword, productId, supplierFilter, mappedSupplierIds])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPanelOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const bindRow = async (row: ImportedSupplierProduct) => {
    if (!productId) return
    setBindingId(row.id)
    setError('')
    try {
      await supplierApi.batchBindImportedProducts({
        product_id: productId,
        supplier_product_ids: [row.id],
      })
      setKeyword('')
      setResults([])
      setPanelOpen(false)
      await loadMappings()
    } catch (e: any) {
      setError(e?.message || '绑定失败')
    } finally {
      setBindingId(null)
    }
  }

  const removeMapping = async (mappingId: number) => {
    if (!window.confirm('确定移除该供应商关联？')) return
    setError('')
    try {
      await supplierApi.removeMapping(mappingId)
      await loadMappings()
    } catch (e: any) {
      setError(e?.message || '移除失败')
    }
  }

  const availableForManual = suppliers.filter(s => !mappedSupplierIds.has(s.id))

  const handleManualAdd = async () => {
    if (!productId || !manual.supplier_id || !manual.supplier_code.trim()) {
      setError('请选择供应商并填写供应商编码')
      return
    }
    setAddingManual(true)
    setError('')
    try {
      await supplierApi.addMapping({
        product_id: productId,
        supplier_id: manual.supplier_id,
        supplier_code: manual.supplier_code.trim(),
        cost_price: manual.cost_price ? parseFloat(manual.cost_price) : undefined,
      })
      setManual({ supplier_id: '', supplier_code: '', cost_price: '' })
      setShowManual(false)
      await loadMappings()
    } catch (e: any) {
      setError(e?.message || '手动添加失败')
    } finally {
      setAddingManual(false)
    }
  }

  if (!productId) return null

  const shellClass = embedded
    ? 'space-y-3'
    : 'xl:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-white p-4'

  return (
    <div className={shellClass}>
      {!embedded && (
        <div>
          <h3 className="text-sm font-semibold text-slate-800">供应商编码</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            从已导入、未绑定的货源中搜索并绑定。每个供应商最多一条关联。
          </p>
        </div>
      )}

      <div className="rounded-md border border-sky-200 bg-sky-50/90 px-3 py-2.5 text-xs text-sky-950 leading-relaxed">
        <span className="font-semibold">更换编码（同一家供应商）：</span>
        请先在下方「已绑定」中找到该供应商，点击 <strong>移除</strong>，再在搜索框中绑定新的导入行。
        若搜不到，通常是因为该供应商仍显示在「已绑定」中，或导入表中尚无对应未映射记录。
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-600">已绑定</p>
        {loading ? (
          <p className="text-sm text-slate-400">加载中...</p>
        ) : mappings.length === 0 ? (
          <p className="text-sm text-slate-400">暂无关联</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {mappings.map(m => (
              <li
                key={m.id}
                className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm text-violet-900"
              >
                <span className="font-medium">{m.supplier_name}</span>
                <span className="font-mono text-xs text-violet-700">{m.supplier_code}</span>
                {m.cost_price != null && (
                  <span className="text-xs text-slate-500">成本 AED {m.cost_price}</span>
                )}
                <button
                  type="button"
                  onClick={() => void removeMapping(m.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div ref={wrapRef} className="relative space-y-2">
        <p className="text-xs font-medium text-slate-600">搜索并添加（已关联的供应商不会出现在结果中）</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white min-w-[140px]"
          >
            <option value="">全部供应商</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={keyword}
            onChange={e => { setKeyword(e.target.value); setPanelOpen(true) }}
            onFocus={() => setPanelOpen(true)}
            placeholder="输入编码或商品名称关键字…"
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        {panelOpen && keyword.trim().length >= 1 && (
          <div className="absolute z-30 mt-1 max-h-60 w-full min-w-[280px] overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {searchLoading ? (
              <div className="px-3 py-4 text-sm text-slate-500">搜索中…</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">无匹配或未导入数据</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {results.map(row => (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={bindingId === row.id}
                      onClick={() => void bindRow(row)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                      <div className="font-medium text-slate-900">{row.supplier_name}</div>
                      <div className="font-mono text-xs text-violet-700">{row.supplier_code}</div>
                      <div className="text-xs text-slate-500 line-clamp-2">{row.product_name}</div>
                      {row.cost_price_aed != null && (
                        <div className="text-xs text-slate-400">供货价 AED {row.cost_price_aed}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {keyword.trim().length < 1 && (
          <p className="text-xs text-slate-400">至少输入 1 个字符开始搜索</p>
        )}
      </div>

      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowManual(v => !v)}
          className="text-sm text-violet-600 hover:text-violet-800"
        >
          {showManual ? '收起' : '手动添加（未在导入表）'}
        </button>
        {showManual && (
          <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-xs text-slate-500">
              适用于尚未执行 Excel 导入、但需要先占位关联的场景。未列出的供应商请先在「站点设置」中维护。
            </p>
            <select
              value={manual.supplier_id}
              onChange={e => setManual(m => ({ ...m, supplier_id: e.target.value }))}
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="">选择供应商</option>
              {availableForManual.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              value={manual.supplier_code}
              onChange={e => setManual(m => ({ ...m, supplier_code: e.target.value }))}
              placeholder="供应商产品编码"
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
            />
            <input
              type="number"
              step="0.01"
              value={manual.cost_price}
              onChange={e => setManual(m => ({ ...m, cost_price: e.target.value }))}
              placeholder="成本价 AED（可选）"
              className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <button
              type="button"
              disabled={addingManual || availableForManual.length === 0}
              onClick={() => void handleManualAdd()}
              className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50"
            >
              {addingManual ? '提交中...' : '添加关联'}
            </button>
            {availableForManual.length === 0 && (
              <p className="text-xs text-amber-700">所有已有供应商均已关联；更换编码请先移除一条。</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
