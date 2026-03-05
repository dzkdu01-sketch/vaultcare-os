import { useState, useMemo, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Check, X, Upload, Scan, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MasterSKU } from '@/types'

interface BulkEntryDialogProps {
  products: MasterSKU[]
  onAddItems: (items: Array<{ sku_id: string; quantity: number; unit_price: string }>) => void
  disabled?: boolean
}

interface ParseResult {
  sku_id: string
  quantity: number
  unit_price: string
  product?: MasterSKU
  error?: string
}

export function BulkEntryDialog({ products, onAddItems, disabled = false }: BulkEntryDialogProps) {
  const [open, setOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [defaultQuantity, setDefaultQuantity] = useState(1)
  const [parseResults, setParseResults] = useState<ParseResult[]>([])
  const [scanningMode, setScanningMode] = useState(false)
  const scanInputRef = useRef<HTMLTextAreaElement>(null)

  // 创建 SKU 编码到商品的映射
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

  // 解析输入文本
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

  // 扫码枪输入处理（扫码枪通常会输入 SKU 后跟回车）
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

  // 确认添加
  const handleConfirm = () => {
    const validItems = parseResults
      .filter((r) => !r.error)
      .map((r) => ({
        sku_id: r.sku_id,
        quantity: r.quantity,
        unit_price: r.unit_price,
      }))

    if (validItems.length > 0) {
      onAddItems(validItems)
      setOpen(false)
      setInputText('')
      setParseResults([])
    }
  }

  // 自动解析
  useEffect(() => {
    if (inputText.trim() && !scanningMode) {
      parseInput()
    } else {
      setParseResults([])
    }
  }, [inputText, scanningMode])

  // 聚焦扫码输入框
  useEffect(() => {
    if (open && scanningMode && scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }, [open, scanningMode])

  const successCount = parseResults.filter((r) => !r.error).length
  const errorCount = parseResults.filter((r) => r.error).length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Upload className="h-4 w-4 mr-2" />
          批量录入
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量录入 SKU</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 模式切换 */}
          <div className="flex gap-2">
            <Button
              variant={!scanningMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScanningMode(false)}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              粘贴录入
            </Button>
            <Button
              variant={scanningMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScanningMode(true)}
              className="flex-1"
            >
              <Scan className="h-4 w-4 mr-2" />
              扫码枪录入
            </Button>
          </div>

          {/* 默认数量 */}
          <div className="space-y-1.5">
            <Label>默认数量</Label>
            <Input
              type="number"
              min="1"
              value={defaultQuantity}
              onChange={(e) => setDefaultQuantity(parseInt(e.target.value) || 1)}
              className="w-32"
            />
            <p className="text-xs text-gray-500">
              {scanningMode ? '扫码枪录入时使用的默认数量' : '未指定数量时使用的默认值'}
            </p>
          </div>

          {!scanningMode ? (
            /* 粘贴录入模式 */
            <>
              <div className="space-y-1.5">
                <Label>粘贴 SKU 列表</Label>
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`支持以下格式（每行一个）：
VC-U-001, 5
VC-U-002
VC-U-003, 10

或使用制表符分隔：
VC-U-001\t5
VC-U-002\t3`}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  支持格式：SKU 编码，数量 或 SKU 编码（使用默认数量）
                </p>
              </div>

              {/* 解析结果预览 */}
              {parseResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>解析结果预览</Label>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="default" className="bg-green-600">
                        成功 {successCount}
                      </Badge>
                      {errorCount > 0 && (
                        <Badge variant="secondary" className="bg-red-500">
                          失败 {errorCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    {parseResults.map((result, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 border-b last:border-0 text-sm',
                          result.error ? 'bg-red-50' : 'bg-green-50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {result.error ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                          <span className="font-mono">{result.product?.master_code || inputText.split('\n')[idx]?.trim()}</span>
                          <span className="text-gray-600">
                            {result.product?.title_en || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">×{result.quantity}</span>
                          <span className="font-medium">AED {result.unit_price || '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* 扫码枪录入模式 */
            <div className="space-y-1.5">
              <Label>扫码枪输入</Label>
              <Textarea
                ref={scanInputRef}
                value={inputText}
                onChange={handleScanInput}
                placeholder="请使用扫码枪扫描商品条形码或 SKU 码...
（扫码后自动添加，支持连续扫描）"
                rows={6}
                className="font-mono text-sm"
                autoFocus
              />
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Scan className="h-4 w-4" />
                <span>扫码枪扫描后会自动添加商品到订单</span>
              </div>
              {parseResults.length > 0 && (
                <div className="text-sm text-green-600">
                  已扫描添加 {parseResults.length} 个商品
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          {!scanningMode && (
            <Button onClick={handleConfirm} disabled={successCount === 0}>
              添加 {successCount} 个商品到订单
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default BulkEntryDialog
