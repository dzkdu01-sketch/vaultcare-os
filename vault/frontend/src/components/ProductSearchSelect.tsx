import { useState, useMemo, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Check, ChevronsUpDown, X, Search, Filter, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MasterSKU, Category } from '@/types'

interface ProductSearchSelectProps {
  products: MasterSKU[]
  value: string
  onChange: (skuId: string, product?: MasterSKU) => void
  placeholder?: string
  disabled?: boolean
  showStock?: boolean
  showFilters?: boolean
}

type AudienceTag = 'for_her' | 'for_him' | 'couple'
const AUDIENCE_TAG_LABELS: Record<AudienceTag, string> = {
  for_her: '她用',
  for_him: '他用',
  couple: '情侣',
}

export function ProductSearchSelect({
  products,
  value,
  onChange,
  placeholder = '搜索商品（按 SKU/名称）...',
  disabled = false,
  showStock = false,
  showFilters = true,
}: ProductSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  // 筛选状态
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedAudienceTags, setSelectedAudienceTags] = useState<AudienceTag[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)

  const selectedProduct = useMemo(() => {
    if (!value) return undefined
    return products.find((p) => p.id === parseInt(value))
  }, [value, products])

  // 提取所有品类（去重）
  const categories = useMemo(() => {
    const categoryMap = new Map<string, string>()
    products.forEach((p) => {
      const catName = p.primary_category_info?.name_en ?? p.primary_category_name ?? '未分类'
      const catId = p.primary_category?.toString() ?? 'uncategorized'
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, catName)
      }
    })
    return Array.from(categoryMap.entries()).map(([id, name]) => ({ id, name }))
  }, [products])

  // 过滤商品：支持搜索 + 品类筛选 + 标签筛选
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

    // 受众标签筛选（支持多选，取交集）
    if (selectedAudienceTags.length > 0) {
      result = result.filter((p) => {
        const tags = p.audience_tags ?? []
        return selectedAudienceTags.every((tag) => tags.includes(tag))
      })
    }

    return result.slice(0, 50)
  }, [products, search, selectedCategory, selectedAudienceTags])

  // 点击外部关闭下拉和筛选面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setShowFilterPanel(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const toggleAudienceTag = (tag: AudienceTag) => {
    setSelectedAudienceTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const clearFilters = () => {
    setSelectedCategory('')
    setSelectedAudienceTags([])
    setSearch('')
  }

  const hasActiveFilters = selectedCategory || selectedAudienceTags.length > 0 || search.trim()

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
        )}
      >
        {selectedProduct ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-mono text-xs text-blue-700 truncate">
              {selectedProduct.master_code}
            </span>
            <span className="truncate flex-1 text-gray-700">
              {selectedProduct.title_en}
            </span>
            {showStock && (
              <Badge variant={selectedProduct.is_active ? 'default' : 'secondary'} className="text-xs shrink-0">
                {selectedProduct.is_active ? '有货' : '缺货'}
              </Badge>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              className="flex-shrink-0 hover:text-red-500 ml-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <ChevronsUpDown className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-md border border-gray-200 bg-white shadow-lg max-h-[400px] overflow-hidden flex flex-col">
          {/* 搜索栏 */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="pl-8 h-9"
                autoFocus
              />
            </div>
          </div>

          {/* 筛选栏 */}
          {showFilters && (
            <div className="p-2 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-xs rounded-md border',
                    hasActiveFilters
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-600'
                  )}
                >
                  <Filter className="h-3 w-3" />
                  筛选
                  {hasActiveFilters && (
                    <span className="ml-1 h-4 w-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">
                      !
                    </span>
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                    清除
                  </button>
                )}

                <span className="text-xs text-gray-500 ml-auto">
                  找到 {filteredProducts.length} 个商品
                </span>
              </div>

              {/* 筛选面板 */}
              {showFilterPanel && (
                <div ref={filterPanelRef} className="mt-2 space-y-3">
                  {/* 品类筛选 */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">品类</label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('')}
                        className={cn(
                          'px-2 py-1 text-xs rounded-md border',
                          !selectedCategory
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : 'border-gray-300 bg-white text-gray-600'
                        )}
                      >
                        全部
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={cn(
                            'px-2 py-1 text-xs rounded-md border',
                            selectedCategory === cat.id
                              ? 'border-blue-300 bg-blue-50 text-blue-700'
                              : 'border-gray-300 bg-white text-gray-600'
                          )}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 受众标签筛选 */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">受众标签</label>
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(AUDIENCE_TAG_LABELS) as AudienceTag[]).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleAudienceTag(tag)}
                          className={cn(
                            'px-2 py-1 text-xs rounded-md border',
                            selectedAudienceTags.includes(tag)
                              ? 'border-blue-300 bg-blue-50 text-blue-700'
                              : 'border-gray-300 bg-white text-gray-600'
                          )}
                        >
                          {AUDIENCE_TAG_LABELS[tag]}
                          {selectedAudienceTags.includes(tag) && (
                            <Check className="h-3 w-3 inline ml-1" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 商品列表 */}
          <div className="overflow-y-auto flex-1 max-h-[240px]">
            {filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                {hasActiveFilters ? '没有匹配筛选条件的商品' : '未找到商品，请尝试其他关键词'}
              </div>
            ) : (
              filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    onChange(product.id.toString(), product)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 border-b border-gray-50 last:border-0',
                    value === product.id.toString() && 'bg-blue-50'
                  )}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 flex-shrink-0',
                      value === product.id.toString() ? 'text-blue-600' : 'opacity-0'
                    )}
                  />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-mono text-xs text-blue-700 truncate">
                      {product.master_code}
                    </span>
                    <span className="truncate text-gray-700 flex-1">
                      {product.title_en}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {showStock && (
                      <Badge variant={product.is_active ? 'default' : 'secondary'} className="text-xs">
                        {product.is_active ? '有货' : '缺货'}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500 font-medium">
                      AED {product.selling_price}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductSearchSelect
