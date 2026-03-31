import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { productApi, supplierApi } from '../../services/app-services'
import type { ProductDetail, ProductSupplierMapping, Supplier } from '../../services/types'

export function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [mappings, setMappings] = useState<ProductSupplierMapping[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showAddMapping, setShowAddMapping] = useState(false)
  const [newMapping, setNewMapping] = useState({ supplier_id: '', supplier_code: '', cost_price: '' })

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [prod, maps, sups] = await Promise.all([
        productApi.getById(id),
        supplierApi.getMappings(id),
        supplierApi.list(),
      ])
      setProduct(prod)
      setMappings(maps)
      setSuppliers(sups)
    } catch {
      setProduct(null)
      setMappings([])
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])

  const handleSync = async () => {
    if (!id) return
    setSyncing(true)
    try {
      const result = await productApi.sync(id)
      const success = result.results.filter(r => r.success).length
      const failed = result.results.filter(r => !r.success).length
      alert(`同步完成：${success} 成功，${failed} 失败`)
      await loadData()
    } catch (err: any) {
      alert(`同步失败: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async () => {
    if (!id || !confirm('确定删除该产品？')) return
    await productApi.remove(id)
    navigate('/products')
  }

  const handleAddMapping = async () => {
    if (!id || !newMapping.supplier_id || !newMapping.supplier_code) return
    await supplierApi.addMapping({
      product_id: id,
      supplier_id: newMapping.supplier_id,
      supplier_code: newMapping.supplier_code,
      cost_price: newMapping.cost_price ? parseFloat(newMapping.cost_price) : undefined,
    })
    setNewMapping({ supplier_id: '', supplier_code: '', cost_price: '' })
    setShowAddMapping(false)
    const maps = await supplierApi.getMappings(id)
    setMappings(maps)
  }

  const handleRemoveMapping = async (mappingId: number) => {
    if (!id || !confirm('确定移除该供应商关联？')) return
    await supplierApi.removeMapping(mappingId)
    const maps = await supplierApi.getMappings(id)
    setMappings(maps)
  }

  if (loading) return <div className="p-6 text-slate-500">加载中...</div>
  if (!product) return <div className="p-6 text-slate-500">产品不存在</div>

  const images = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || [])
  const mappedSupplierIds = mappings.map(m => m.supplier_id)
  const availableSuppliers = suppliers.filter(s => !mappedSupplierIds.includes(s.id))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/products" className="text-sm text-violet-600 hover:text-violet-800">&larr; 返回列表</Link>
          <h2 className="text-lg font-semibold text-slate-900 mt-1">{product.name}</h2>
          <p className="text-sm text-slate-500 font-mono">{product.sku}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700 disabled:opacity-50"
          >
            {syncing ? '同步中...' : '同步到所有站点'}
          </button>
          <button
            onClick={() => navigate(`/products/${id}/edit`)}
            className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
          >
            编辑
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50"
          >
            删除
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="font-medium text-slate-900">基本信息</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex"><dt className="w-28 text-slate-500">Categories</dt><dd className="text-slate-900">{product.category || '-'}</dd></div>
              <div className="flex"><dt className="w-28 text-slate-500">Sale Price</dt><dd className="text-slate-900">{product.sale_price > 0 ? `AED ${product.sale_price}` : '-'}</dd></div>
              <div className="flex"><dt className="w-28 text-slate-500">Regular Price</dt><dd className="text-slate-900">{product.regular_price > 0 ? `AED ${product.regular_price}` : '-'}</dd></div>
              <div className="flex"><dt className="w-28 text-slate-500">Status</dt><dd><span className={`px-2 py-0.5 rounded-full text-xs ${product.status === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{product.status === 1 ? 'Active' : 'Draft'}</span></dd></div>
              {(() => {
                const tags = typeof product.tags === 'string' ? JSON.parse(product.tags || '[]') : (product.tags || [])
                return tags.length > 0 ? (
                  <div className="flex"><dt className="w-28 text-slate-500">Tags</dt><dd className="flex flex-wrap gap-1">{tags.map((t: string) => (
                    <span key={t} className="px-2 py-0.5 bg-violet-50 text-violet-600 text-xs rounded-full">{t}</span>
                  ))}</dd></div>
                ) : null
              })()}
            </dl>
            {product.short_description && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Short Description</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{product.short_description}</p>
              </div>
            )}
            {product.description && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{product.description}</p>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-slate-900">供应商</h3>
              {availableSuppliers.length > 0 && !showAddMapping && (
                <button onClick={() => setShowAddMapping(true)} className="text-sm text-violet-600 hover:text-violet-800">
                  + 关联供应商
                </button>
              )}
            </div>
            {mappings.length === 0 && !showAddMapping ? (
              <p className="text-sm text-slate-400">未关联供应商</p>
            ) : (
              <div className="space-y-2">
                {mappings.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                    <div>
                      <span className="text-slate-900">{m.supplier_name}</span>
                      <span className="text-slate-400 ml-2 font-mono">{m.supplier_code}</span>
                      {m.cost_price != null && <span className="text-slate-400 ml-2">¥{m.cost_price}</span>}
                    </div>
                    <button onClick={() => handleRemoveMapping(m.id)} className="text-red-400 hover:text-red-600 text-xs">移除</button>
                  </div>
                ))}
              </div>
            )}
            {showAddMapping && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                <select
                  value={newMapping.supplier_id}
                  onChange={e => setNewMapping(prev => ({ ...prev, supplier_id: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                >
                  <option value="">选择供应商</option>
                  {availableSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input
                  value={newMapping.supplier_code}
                  onChange={e => setNewMapping(prev => ({ ...prev, supplier_code: e.target.value }))}
                  placeholder="供应商产品编码（如 vip09）"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                />
                <input
                  value={newMapping.cost_price}
                  onChange={e => setNewMapping(prev => ({ ...prev, cost_price: e.target.value }))}
                  placeholder="采购价（可选）"
                  type="number"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddMapping} className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded hover:bg-violet-700">确定</button>
                  <button onClick={() => setShowAddMapping(false)} className="px-3 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50">取消</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {images.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="font-medium text-slate-900 mb-3">图片</h3>
              <div className="grid grid-cols-3 gap-2">
                {images.map((url: string, i: number) => (
                  <img key={i} src={url} alt="" className="w-full h-24 object-cover rounded border border-slate-200" />
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-medium text-slate-900 mb-3">同步状态</h3>
            {(!product.sync || product.sync.length === 0) ? (
              <p className="text-sm text-slate-400">尚未同步到任何站点</p>
            ) : (
              <div className="space-y-2">
                {product.sync.map(s => (
                  <div key={s.site_id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{s.site_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      s.sync_status === 'synced' ? 'bg-green-100 text-green-700' :
                      s.sync_status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {s.sync_status === 'synced' ? '已同步' : s.sync_status === 'failed' ? '失败' : '待同步'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
