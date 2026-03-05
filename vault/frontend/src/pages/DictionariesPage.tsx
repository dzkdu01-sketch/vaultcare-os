import { useCallback, useEffect, useMemo, useState } from 'react'
import { bannedWordsAPI, brandsAPI, categoriesAPI, operationalTagsAPI, suppliersAPI } from '@/api/endpoints'
import type { BannedWord, Brand, Category, OperationalTag, Supplier } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, RefreshCw, Edit2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type DictType = 'category' | 'tag' | 'brand' | 'supplier' | 'banned_word'
type DictionariesPageMode = 'all' | 'tags' | 'categories'

interface DictionariesPageProps {
  mode?: DictionariesPageMode
}

export default function DictionariesPage({ mode = 'all' }: DictionariesPageProps) {
  const { isStaff, isSuperuser } = useAuth()
  const canEdit = isStaff || isSuperuser
  const showCategories = mode === 'all' || mode === 'categories'
  const showTags = mode === 'all' || mode === 'tags'
  const showBrands = mode === 'all'
  const showSuppliers = mode === 'all'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<OperationalTag[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dictType, setDictType] = useState<DictType>('category')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false)
  const [replaceType, setReplaceType] = useState<DictType>('category')
  const [replaceSourceId, setReplaceSourceId] = useState<number | null>(null)
  const [replaceTargetId, setReplaceTargetId] = useState<number | null>(null)

  const [categoryForm, setCategoryForm] = useState({ code: '', name_en: '', name_zh: '' })
  const [tagForm, setTagForm] = useState({ name: '' })
  const [brandForm, setBrandForm] = useState({ name: '' })
  const [supplierForm, setSupplierForm] = useState({
    name: '', code_prefix: '', settlement_cycle: '', priority: 10, is_active: true,
  })

  // S2-W3-3: 脏词管理状态
  const [bannedWords, setBannedWords] = useState<BannedWord[]>([])
  const [bannedWordForm, setBannedWordForm] = useState<{ word: string; category: BannedWord['category'] }>({
    word: '',
    category: 'other',
  })
  const [editingBannedWordId, setEditingBannedWordId] = useState<number | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, tRes, bRes, sRes, bwRes] = await Promise.all([
        categoriesAPI.list({ include_inactive: true }),
        operationalTagsAPI.list({ include_inactive: true }),
        brandsAPI.list({ include_inactive: true }),
        suppliersAPI.list(),
        bannedWordsAPI.list({ include_inactive: true }),
      ])
      setCategories(cRes.data.results ?? cRes.data)
      setTags(tRes.data.results ?? tRes.data)
      setBrands(bRes.data.results ?? bRes.data)
      setSuppliers(sRes.data.results ?? sRes.data)
      setBannedWords(bwRes.data.results ?? bwRes.data)
    } catch (e) {
      console.error(e)
      alert('加载字典失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const resetForm = useCallback((type: DictType) => {
    setEditingId(null)
    setDictType(type)
    setCategoryForm({ code: '', name_en: '', name_zh: '' })
    setTagForm({ name: '' })
    setBrandForm({ name: '' })
    setSupplierForm({ name: '', code_prefix: '', settlement_cycle: '', priority: 10, is_active: true })
  }, [])

  const resetBannedWordForm = useCallback(() => {
    setEditingBannedWordId(null)
    setBannedWordForm({ word: '', category: 'other' })
  }, [])

  const hasBannedWords = (value: string) => {
    const normalized = value.trim().toLowerCase()
    return bannedWords.some((bw) => bw.is_active && bw.word.toLowerCase().includes(normalized) || normalized.includes(bw.word.toLowerCase()))
  }

  const validateFormBeforeSave = () => {
    if (dictType === 'category') {
      if (hasBannedWords(categoryForm.name_en) || hasBannedWords(categoryForm.name_zh)) {
        alert('分类名称包含禁用词，请修改后再保存')
        return false
      }
      return true
    }
    if (dictType === 'tag') {
      if (hasBannedWords(tagForm.name)) {
        alert('标签名包含禁用词，请修改后再保存')
        return false
      }
      return true
    }
    if (dictType === 'brand') {
      if (hasBannedWords(brandForm.name)) {
        alert('品牌名包含禁用词，请修改后再保存')
        return false
      }
      return true
    }
    if (dictType === 'supplier') {
      if (hasBannedWords(supplierForm.name) || hasBannedWords(supplierForm.settlement_cycle)) {
        alert('供应商字段包含禁用词，请修改后再保存')
        return false
      }
      return true
    }
    if (dictType === 'banned_word') {
      if (!bannedWordForm.word.trim()) {
        alert('脏词内容不能为空')
        return false
      }
      return true
    }
    return true
  }

  const openCreate = (type: DictType) => {
    if (!canEdit) return
    if (type === 'banned_word') {
      openCreateBannedWord()
      return
    }
    resetForm(type)
    setDialogOpen(true)
  }

  const openEditCategory = (item: Category) => {
    if (!canEdit) return
    resetForm('category')
    setEditingId(item.id)
    setCategoryForm({ code: item.code, name_en: item.name_en, name_zh: item.name_zh })
    setDialogOpen(true)
  }

  const openEditTag = (item: OperationalTag) => {
    if (!canEdit) return
    resetForm('tag')
    setEditingId(item.id)
    setTagForm({ name: item.name })
    setDialogOpen(true)
  }

  const openEditBrand = (item: Brand) => {
    if (!canEdit) return
    resetForm('brand')
    setEditingId(item.id)
    setBrandForm({ name: item.name })
    setDialogOpen(true)
  }

  const openEditSupplier = (item: Supplier) => {
    if (!canEdit) return
    resetForm('supplier')
    setEditingId(item.id)
    setSupplierForm({
      name: item.name,
      code_prefix: item.code_prefix,
      settlement_cycle: item.settlement_cycle,
      priority: item.priority,
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!canEdit) return
    if (dictType === 'banned_word') {
      await handleSaveBannedWord()
      return
    }
    if (!validateFormBeforeSave()) return
    setSaving(true)
    try {
      if (dictType === 'category') {
        if (editingId) await categoriesAPI.update(editingId, categoryForm)
        else await categoriesAPI.create(categoryForm)
      } else if (dictType === 'tag') {
        if (editingId) await operationalTagsAPI.update(editingId, tagForm)
        else await operationalTagsAPI.create(tagForm)
      } else if (dictType === 'brand') {
        if (editingId) await brandsAPI.update(editingId, brandForm)
        else await brandsAPI.create(brandForm)
      } else {
        if (editingId) await suppliersAPI.update(editingId, supplierForm)
        else await suppliersAPI.create(supplierForm)
      }
      setDialogOpen(false)
      await loadAll()
    } catch (e) {
      console.error(e)
      alert('保存失败，请检查输入是否重复或不合法')
    } finally {
      setSaving(false)
    }
  }

  const openDeactivateWithReplacement = (type: DictType, sourceId: number) => {
    if (!canEdit) return
    setReplaceType(type)
    setReplaceSourceId(sourceId)
    setReplaceTargetId(null)
    setReplaceDialogOpen(true)
  }

  const getReplacementOptions = () => {
    if (replaceType === 'category') {
      return categories.filter((item) => item.is_active && item.id !== replaceSourceId)
    }
    if (replaceType === 'tag') {
      return tags.filter((item) => item.is_active && item.id !== replaceSourceId)
    }
    if (replaceType === 'brand') {
      return brands.filter((item) => item.is_active && item.id !== replaceSourceId)
    }
    return suppliers.filter((item) => item.is_active && item.id !== replaceSourceId)
  }

  const submitDeactivateWithReplacement = async () => {
    if (!canEdit || !replaceSourceId || !replaceTargetId) return
    setSaving(true)
    try {
      if (replaceType === 'category') {
        await categoriesAPI.deactivateWithReplacement(replaceSourceId, replaceTargetId)
      } else if (replaceType === 'tag') {
        await operationalTagsAPI.deactivateWithReplacement(replaceSourceId, replaceTargetId)
      } else if (replaceType === 'brand') {
        await brandsAPI.deactivateWithReplacement(replaceSourceId, replaceTargetId)
      } else {
        await suppliersAPI.deactivateWithReplacement(replaceSourceId, replaceTargetId)
      }
      setReplaceDialogOpen(false)
      await loadAll()
    } catch (e) {
      console.error(e)
      alert('停用失败，请检查替代项后重试')
    } finally {
      setSaving(false)
    }
  }

  const toggleCategoryStatus = async (item: Category) => {
    if (!canEdit) return
    if (item.is_active) {
      openDeactivateWithReplacement('category', item.id)
      return
    }
    await categoriesAPI.update(item.id, { is_active: true })
    await loadAll()
  }

  const toggleTagStatus = async (item: OperationalTag) => {
    if (!canEdit) return
    if (item.is_active) {
      openDeactivateWithReplacement('tag', item.id)
      return
    }
    await operationalTagsAPI.update(item.id, { is_active: true })
    await loadAll()
  }

  const toggleBrandStatus = async (item: Brand) => {
    if (!canEdit) return
    if (item.is_active) {
      openDeactivateWithReplacement('brand', item.id)
      return
    }
    await brandsAPI.update(item.id, { is_active: true })
    await loadAll()
  }

  const toggleSupplierStatus = async (item: Supplier) => {
    if (!canEdit) return
    if (item.is_active) {
      openDeactivateWithReplacement('supplier', item.id)
      return
    }
    await suppliersAPI.update(item.id, { is_active: true })
    await loadAll()
  }

  // S2-W3-3: 脏词管理函数
  const openCreateBannedWord = () => {
    if (!canEdit) return
    resetBannedWordForm()
    setDialogOpen(true)
    setDictType('banned_word')
  }

  const openEditBannedWord = (item: BannedWord) => {
    if (!canEdit) return
    setEditingBannedWordId(item.id)
    setBannedWordForm({ word: item.word, category: item.category })
    setDialogOpen(true)
    setDictType('banned_word')
  }

  const handleSaveBannedWord = async () => {
    if (!canEdit) return
    setSaving(true)
    try {
      if (editingBannedWordId) {
        await bannedWordsAPI.update(editingBannedWordId, bannedWordForm)
      } else {
        await bannedWordsAPI.create(bannedWordForm)
      }
      setDialogOpen(false)
      await loadAll()
    } catch (e) {
      console.error(e)
      alert('保存失败，请检查输入是否重复或不合法')
    } finally {
      setSaving(false)
    }
  }

  const toggleBannedWordStatus = async (item: BannedWord) => {
    if (!canEdit) return
    await bannedWordsAPI.update(item.id, { is_active: !item.is_active })
    await loadAll()
  }

  const deleteBannedWord = async (item: BannedWord) => {
    if (!canEdit) return
    if (!confirm(`确定要删除脏词 "${item.word}" 吗？`)) return
    await bannedWordsAPI.delete(item.id)
    await loadAll()
  }

  const dialogTitle = useMemo(() => {
    const mode = editingId || editingBannedWordId ? '编辑' : '新增'
    if (dictType === 'category') return `${mode}分类`
    if (dictType === 'tag') return `${mode}标签`
    if (dictType === 'brand') return `${mode}品牌`
    if (dictType === 'supplier') return `${mode}供应商`
    if (dictType === 'banned_word') return `${mode}脏词`
    return `${mode}字典项`
  }, [dictType, editingId, editingBannedWordId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'tags' ? '标签管理' : mode === 'categories' ? '品类管理' : '字典治理'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'all'
              ? '分类、标签、品牌、供应商统一管理'
              : mode === 'tags'
                ? '商品运营标签管理'
                : '商品品类字典管理'}
          </p>
          {!canEdit && (
            <p className="text-xs text-amber-600 mt-1">当前账号为只读角色，可查看但不可编辑。</p>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={loadAll} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {showCategories && (
          <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">分类字典</h2>
              <Button size="sm" onClick={() => openCreate('category')} disabled={!canEdit}>
                <Plus className="h-3.5 w-3.5 mr-1" /> 新增
              </Button>
            </div>
            {categories.map((item) => (
              <div key={item.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="font-medium">{item.code} - {item.name_en}</div>
                  <div className="text-xs text-gray-500">{item.name_zh}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.is_active ? 'success' : 'secondary'}>
                    {item.is_active ? '启用' : '停用'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCategory(item)} disabled={!canEdit}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleCategoryStatus(item)} disabled={!canEdit}>
                    {item.is_active ? '停用' : '启用'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
          </Card>
        )}

        {showTags && (
          <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">运营标签</h2>
              <Button size="sm" onClick={() => openCreate('tag')} disabled={!canEdit}>
                <Plus className="h-3.5 w-3.5 mr-1" /> 新增
              </Button>
            </div>
            {tags.map((item) => (
              <div key={item.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="font-medium">{item.name}</div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.is_active ? 'success' : 'secondary'}>
                    {item.is_active ? '启用' : '停用'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTag(item)} disabled={!canEdit}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleTagStatus(item)} disabled={!canEdit}>
                    {item.is_active ? '停用' : '启用'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
          </Card>
        )}

        {showBrands && (
          <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">品牌字典</h2>
              <Button size="sm" onClick={() => openCreate('brand')} disabled={!canEdit}>
                <Plus className="h-3.5 w-3.5 mr-1" /> 新增
              </Button>
            </div>
            {brands.map((item) => (
              <div key={item.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="font-medium">{item.name}</div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.is_active ? 'success' : 'secondary'}>
                    {item.is_active ? '启用' : '停用'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBrand(item)} disabled={!canEdit}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleBrandStatus(item)} disabled={!canEdit}>
                    {item.is_active ? '停用' : '启用'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
          </Card>
        )}

        {showSuppliers && (
          <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">供应商字典</h2>
              <Button size="sm" onClick={() => openCreate('supplier')} disabled={!canEdit}>
                <Plus className="h-3.5 w-3.5 mr-1" /> 新增
              </Button>
            </div>
            {suppliers.map((item) => (
              <div key={item.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500">前缀：{item.code_prefix} / 优先级：{item.priority}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.is_active ? 'success' : 'secondary'}>
                    {item.is_active ? '启用' : '停用'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSupplier(item)} disabled={!canEdit}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleSupplierStatus(item)} disabled={!canEdit}>
                    {item.is_active ? '停用' : '启用'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
          </Card>
        )}

        {/* S2-W3-3: 脏词字典管理 */}
        <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">脏词字典</h2>
            <Button size="sm" onClick={() => openCreateBannedWord()} disabled={!canEdit}>
              <Plus className="h-3.5 w-3.5 mr-1" /> 新增
            </Button>
          </div>
          {bannedWords.map((item) => (
            <div key={item.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <div className="font-medium">{item.word}</div>
                <div className="text-xs text-gray-500">
                  分类：{
                    item.category === 'profanity' ? '脏话' :
                    item.category === 'fraud' ? '诈骗' :
                    item.category === 'contraband' ? '违禁品' :
                    item.category === 'adult' ? '成人内容' :
                    item.category === 'political' ? '敏感政治' : '其他'
                  }
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={item.is_active ? 'success' : 'secondary'}>
                  {item.is_active ? '启用' : '停用'}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBannedWord(item)} disabled={!canEdit}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleBannedWordStatus(item)} disabled={!canEdit}>
                  {item.is_active ? '停用' : '启用'}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteBannedWord(item)} disabled={!canEdit}>
                  删除
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {dictType === 'category' && (
              <>
                <div className="space-y-1.5">
                  <Label>分类编码</Label>
                  <Input maxLength={1} value={categoryForm.code} onChange={(e) => setCategoryForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>英文名</Label>
                  <Input value={categoryForm.name_en} onChange={(e) => setCategoryForm((prev) => ({ ...prev, name_en: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>中文名</Label>
                  <Input value={categoryForm.name_zh} onChange={(e) => setCategoryForm((prev) => ({ ...prev, name_zh: e.target.value }))} />
                </div>
              </>
            )}

            {dictType === 'tag' && (
              <div className="space-y-1.5">
                <Label>标签名</Label>
                <Input value={tagForm.name} onChange={(e) => setTagForm({ name: e.target.value })} />
              </div>
            )}

            {dictType === 'brand' && (
              <div className="space-y-1.5">
                <Label>品牌名</Label>
                <Input value={brandForm.name} onChange={(e) => setBrandForm({ name: e.target.value })} />
              </div>
            )}

            {dictType === 'supplier' && (
              <>
                <div className="space-y-1.5">
                  <Label>名称</Label>
                  <Input value={supplierForm.name} onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>编码前缀</Label>
                  <Input value={supplierForm.code_prefix} onChange={(e) => setSupplierForm((prev) => ({ ...prev, code_prefix: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>结算周期说明</Label>
                  <Input value={supplierForm.settlement_cycle} onChange={(e) => setSupplierForm((prev) => ({ ...prev, settlement_cycle: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>优先级</Label>
                  <Input type="number" value={supplierForm.priority} onChange={(e) => setSupplierForm((prev) => ({ ...prev, priority: Number(e.target.value) || 10 }))} />
                </div>
              </>
            )}

            {dictType === 'banned_word' && (
              <>
                <div className="space-y-1.5">
                  <Label>脏词内容</Label>
                  <Input
                    value={bannedWordForm.word}
                    onChange={(e) => setBannedWordForm((prev) => ({ ...prev, word: e.target.value }))}
                    placeholder="请输入需要拦截的脏词"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>脏词分类</Label>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={bannedWordForm.category}
                    onChange={(e) => setBannedWordForm((prev) => ({ ...prev, category: e.target.value as typeof bannedWordForm.category }))}
                  >
                    <option value="profanity">脏话</option>
                    <option value="fraud">诈骗</option>
                    <option value="contraband">违禁品</option>
                    <option value="adult">成人内容</option>
                    <option value="political">敏感政治</option>
                    <option value="other">其他</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>停用并选择替代项</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              停用后将把历史引用迁移到替代项，避免业务中断。
            </p>
            <div className="space-y-1.5">
              <Label>替代项</Label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={replaceTargetId ?? ''}
                onChange={(e) => setReplaceTargetId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">请选择替代项</option>
                {getReplacementOptions().map((item) => (
                  <option key={item.id} value={item.id}>
                    {'name' in item ? item.name : `${item.code} - ${item.name_en}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={submitDeactivateWithReplacement} disabled={saving || !replaceTargetId}>
              {saving ? '处理中...' : '确认停用'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
