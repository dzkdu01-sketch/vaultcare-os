import { useEffect, useState } from 'react'
import { financeAPI } from '@/api/endpoints'
import type { FinanceSummary } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

interface DistributorRow {
  distributor__name: string
  order_count: number
  revenue: string
  profit: string
}

interface SupplierRow {
  routed_supplier__name: string
  order_count: number
  revenue: string
  profit: string
}

interface DailyRow {
  date: string
  order_count: number
  revenue: string
  profit: string
}

const PERIODS = [
  { value: 'week', label: '近7天' },
  { value: 'month', label: '近30天' },
  { value: 'quarter', label: '近90天' },
  { value: 'all', label: '全部' },
]

export default function FinancePage() {
  const [period, setPeriod] = useState('month')
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [byDist, setByDist] = useState<DistributorRow[]>([])
  const [bySupplier, setBySupplier] = useState<SupplierRow[]>([])
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [sumRes, distRes, supRes, dailyRes] = await Promise.all([
        financeAPI.summary(period),
        financeAPI.byDistributor(),
        financeAPI.bySupplier(),
        financeAPI.daily(),
      ])
      setSummary(sumRes.data)
      setByDist(distRes.data)
      setBySupplier(supRes.data)
      setDaily(dailyRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [period])

  const signRate = summary && summary.total_orders > 0
    ? ((summary.delivered_orders / summary.total_orders) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">财务看板</h1>
          <p className="text-gray-500 text-sm mt-1">基于已签收订单统计</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  period === p.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={load}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '总收入', value: formatCurrency(summary?.total_revenue ?? 0), sub: '已签收订单', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '总利润', value: formatCurrency(summary?.total_profit ?? 0), sub: '扣除所有成本后', color: 'text-green-600', bg: 'bg-green-50' },
          { label: '签收率', value: `${signRate}%`, sub: `${summary?.delivered_orders}/${summary?.total_orders} 单`, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: '平均客单价', value: formatCurrency(summary?.avg_order_value ?? 0), sub: '签收单均价', color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className={`p-5 ${item.bg}`}>
              <p className="text-sm text-gray-600">{item.label}</p>
              <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
              <p className="text-xs text-gray-400 mt-1">{item.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Distributor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              分销商维度
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">分销商</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">单量</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">收入</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">利润</th>
                </tr>
              </thead>
              <tbody>
                {byDist.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">暂无数据</td></tr>
                )}
                {byDist.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{row.distributor__name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{row.order_count}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={parseFloat(row.profit) >= 0 ? 'text-green-600 font-medium' : 'text-red-500'}>
                        {formatCurrency(row.profit)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* By Supplier */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-purple-500" />
              供应商维度
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">供应商</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">单量</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">收入</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">利润</th>
                </tr>
              </thead>
              <tbody>
                {bySupplier.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">暂无数据</td></tr>
                )}
                {bySupplier.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{row.routed_supplier__name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{row.order_count}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={parseFloat(row.profit) >= 0 ? 'text-green-600 font-medium' : 'text-red-500'}>
                        {formatCurrency(row.profit)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Daily trend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">每日趋势（近30天签收）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">日期</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">签收单量</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">当日收入</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">当日利润</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600">利润趋势</th>
                </tr>
              </thead>
              <tbody>
                {daily.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">暂无数据</td></tr>
                )}
                {daily.map((row, i) => {
                  const profitNum = parseFloat(row.profit) || 0
                  const maxProfit = Math.max(...daily.map((d) => parseFloat(d.profit) || 0), 1)
                  const barPct = Math.max((profitNum / maxProfit) * 100, 0)
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600">{row.date}</td>
                      <td className="px-4 py-2.5 text-right">{row.order_count}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={profitNum >= 0 ? 'text-green-600 font-medium' : 'text-red-500'}>
                          {formatCurrency(row.profit)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-green-400"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
