import { useEffect, useState } from 'react'
import { financeAPI, ordersAPI, productsAPI } from '@/api/endpoints'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { FinanceSummary, Order, ReviewMetrics, Phase1Metrics } from '@/types'
import {
  TrendingUp,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Package,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  Filter,
} from 'lucide-react'

const statusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline' }> = {
  pending: { label: '待审核', variant: 'warning' },
  reviewed: { label: '已审核', variant: 'default' },
  pushed: { label: '已推单', variant: 'default' },
  shipped: { label: '派送中', variant: 'default' },
  delivered: { label: '已签收', variant: 'success' },
  rejected: { label: '已拒收', variant: 'destructive' },
  returned: { label: '已退回', variant: 'secondary' },
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBgColor,
  sub,
  trend,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  iconColor: string
  iconBgColor: string
  sub?: string
  trend?: 'up' | 'down'
}) {
  return (
    <Card className="border-neutral-200/60 rounded-2xl hover:shadow-xl transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-[15px] font-medium text-neutral-600 mb-2">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-neutral-900 tracking-tight">{value}</p>
              {trend && (
                <span className={`flex items-center text-sm font-semibold ${
                  trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {trend === 'up' ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                </span>
              )}
            </div>
            {sub && <p className="text-sm text-neutral-500 mt-2">{sub}</p>}
          </div>
          <div className={`rounded-2xl p-4 ${iconBgColor} shadow-sm`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [reviewMetrics, setReviewMetrics] = useState<ReviewMetrics | null>(null)
  const [phase1Metrics, setPhase1Metrics] = useState<Phase1Metrics | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    const load = async () => {
      try {
        const [sumRes, ordersRes, metricsRes, phase1Res] = await Promise.all([
          financeAPI.summary('month'),
          ordersAPI.list({ ordering: '-created_at', page_size: 8 }),
          productsAPI.reviewMetrics(),
          productsAPI.phase1Metrics(),
        ])
        setSummary(sumRes.data)
        setRecentOrders(ordersRes.data.results ?? ordersRes.data)
        setReviewMetrics(metricsRes.data)
        setPhase1Metrics(phase1Res.data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-violet-600" />
      </div>
    )
  }

  const signRate =
    summary && summary.total_orders > 0
      ? ((summary.delivered_orders / summary.total_orders) * 100).toFixed(0)
      : '0'

  // Filter orders based on search and status
  const filteredOrders = recentOrders.filter(order => {
    const matchesSearch = searchQuery === '' ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.distributor_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['订单号', '客户', '分销商', '金额', '状态', '时间']
    const rows = filteredOrders.map(order => [
      order.order_number,
      order.customer_name,
      order.distributor_name,
      order.total_amount.toString(),
      statusConfig[order.status]?.label || order.status,
      formatDate(order.created_at)
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `订单数据_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">全局看板</h1>
        <p className="text-base text-neutral-600">本月数据概览与业务指标</p>
      </div>

      {/* Primary Stats */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-5">核心指标</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="总订单"
            value={summary?.total_orders ?? 0}
            icon={ShoppingCart}
            iconColor="text-violet-600"
            iconBgColor="bg-violet-50"
            trend="up"
          />
          <StatCard
            title="已签收"
            value={summary?.delivered_orders ?? 0}
            icon={CheckCircle}
            iconColor="text-emerald-600"
            iconBgColor="bg-emerald-50"
            sub={`签收率 ${signRate}%`}
            trend="up"
          />
          <StatCard
            title="总收入"
            value={formatCurrency(summary?.total_revenue ?? 0)}
            icon={DollarSign}
            iconColor="text-fuchsia-600"
            iconBgColor="bg-fuchsia-50"
            trend="up"
          />
          <StatCard
            title="总利润"
            value={formatCurrency(summary?.total_profit ?? 0)}
            icon={TrendingUp}
            iconColor="text-amber-600"
            iconBgColor="bg-amber-50"
            trend="up"
          />
        </div>
      </div>

      {/* Secondary Stats */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-5">运营数据</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="待处理"
            value={summary?.pending_orders ?? 0}
            icon={Clock}
            iconColor="text-yellow-600"
            iconBgColor="bg-yellow-50"
          />
          <StatCard
            title="已拒收"
            value={summary?.rejected_orders ?? 0}
            icon={XCircle}
            iconColor="text-rose-600"
            iconBgColor="bg-rose-50"
          />
          <StatCard
            title="平均客单价"
            value={formatCurrency(summary?.avg_order_value ?? 0)}
            icon={Package}
            iconColor="text-cyan-600"
            iconBgColor="bg-cyan-50"
          />
          <StatCard
            title="配送费合计"
            value={formatCurrency(summary?.total_delivery_fees ?? 0)}
            icon={AlertCircle}
            iconColor="text-neutral-600"
            iconBgColor="bg-neutral-100"
          />
        </div>
      </div>

      {/* F13 Review Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-5">发布门禁指标（F13）</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="一次通过率"
            value={`${reviewMetrics?.first_pass_rate ?? 0}%`}
            icon={CheckCircle}
            iconColor="text-emerald-600"
            iconBgColor="bg-emerald-50"
            sub={`一次通过 ${reviewMetrics?.first_pass_approved_count ?? 0} / 通过总数 ${reviewMetrics?.approved_count ?? 0}`}
          />
          <StatCard
            title="退回重提次数"
            value={reviewMetrics?.rework_count ?? 0}
            icon={ArrowDown}
            iconColor="text-rose-600"
            iconBgColor="bg-rose-50"
          />
          <StatCard
            title="紧急放行次数"
            value={reviewMetrics?.emergency_override_count ?? 0}
            icon={AlertCircle}
            iconColor="text-amber-600"
            iconBgColor="bg-amber-50"
          />
          <StatCard
            title="当前待审核"
            value={reviewMetrics?.pending_review_count ?? 0}
            icon={Clock}
            iconColor="text-violet-600"
            iconBgColor="bg-violet-50"
          />
        </div>
      </div>

      {/* Phase 1 Metrics - 审核效率指标 */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-5">第 1 阶段业务指标（审核效率）</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="当日可审核数"
            value={phase1Metrics?.review_ready_daily_count ?? 0}
            icon={Package}
            iconColor="text-violet-600"
            iconBgColor="bg-violet-50"
            sub="录入完成待审核商品数"
          />
          <StatCard
            title="审核员日处理量"
            value={phase1Metrics?.review_processed_daily_count ?? 0}
            icon={CheckCircle}
            iconColor="text-emerald-600"
            iconBgColor="bg-emerald-50"
            sub="审核员当日通过/驳回数"
          />
          <StatCard
            title="中位处理时长"
            value={`${phase1Metrics?.median_hours_to_review_ready ?? 0} 小时`}
            icon={Clock}
            iconColor="text-amber-600"
            iconBgColor="bg-amber-50"
            sub="录入到可审核中位时长"
          />
          <StatCard
            title="窗口样本数"
            value={phase1Metrics?.review_ready_window_count ?? 0}
            icon={TrendingUp}
            iconColor="text-cyan-600"
            iconBgColor="bg-cyan-50"
            sub="用于计算中位时长的样本数"
          />
        </div>

        {/* 7 天趋势图 */}
        {phase1Metrics?.daily_trend && phase1Metrics.daily_trend.length > 0 && (
          <Card className="mt-5 border-neutral-200/60 rounded-2xl">
            <CardHeader className="border-b border-neutral-100 px-6 py-4">
              <CardTitle className="text-base font-semibold text-neutral-900">近 7 天趋势</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-3">
                {phase1Metrics.daily_trend.map((day) => (
                  <div key={day.date} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors">
                    <span className="text-xs text-neutral-500">{day.date.slice(5)}</span>
                    <div className="w-full flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-500">可审核</span>
                        <span className="font-semibold text-violet-600">{day.review_ready_count}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-500">已处理</span>
                        <span className="font-semibold text-emerald-600">{day.review_processed_count}</span>
                      </div>
                    </div>
                    {/* 简易柱状图 */}
                    <div className="w-full flex gap-1 h-16 items-end justify-center">
                      <div
                        className="w-4 bg-violet-500 rounded-t transition-all"
                        style={{ height: `${Math.max(8, (day.review_ready_count / Math.max(1, ...phase1Metrics.daily_trend.map(d => d.review_ready_count))) * 100)}%` }}
                        title={`可审核：${day.review_ready_count}`}
                      />
                      <div
                        className="w-4 bg-emerald-500 rounded-t transition-all"
                        style={{ height: `${Math.max(8, (day.review_processed_count / Math.max(1, ...phase1Metrics.daily_trend.map(d => d.review_processed_count))) * 100)}%` }}
                        title={`已处理：${day.review_processed_count}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-neutral-500">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-violet-500" />
                  <span>可审核数</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span>已处理数</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Orders */}
      <div>
        <Card className="border-neutral-200/60 rounded-2xl shadow-sm">
          <CardHeader className="border-b border-neutral-100 px-8 py-5">
            <CardTitle className="text-xl font-semibold text-neutral-900">最近订单</CardTitle>
          </CardHeader>

          {/* Table Toolbar */}
          <div className="px-8 py-4 border-b border-neutral-100 bg-neutral-50/30">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="搜索订单号、客户、分销商..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-lg border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-colors"
              >
                <option value="all">全部状态</option>
                <option value="pending">待审核</option>
                <option value="reviewed">已审核</option>
                <option value="pushed">已推单</option>
                <option value="shipped">派送中</option>
                <option value="delivered">已签收</option>
                <option value="rejected">已拒收</option>
                <option value="returned">已退回</option>
              </select>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
              <span className="text-sm text-neutral-500 ml-auto">
                显示 {filteredOrders.length} / {recentOrders.length} 条
              </span>
            </div>
          </div>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/50">
                    <th className="text-left px-8 py-3 text-[15px] font-semibold text-neutral-700">订单号</th>
                    <th className="text-left px-8 py-3 text-[15px] font-semibold text-neutral-700">客户</th>
                    <th className="text-left px-8 py-3 text-[15px] font-semibold text-neutral-700">分销商</th>
                    <th className="text-right px-8 py-3 text-[15px] font-semibold text-neutral-700">金额</th>
                    <th className="text-center px-8 py-3 text-[15px] font-semibold text-neutral-700">状态</th>
                    <th className="text-left px-8 py-3 text-[15px] font-semibold text-neutral-700">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const cfg = statusConfig[order.status]
                    return (
                      <tr
                        key={order.id}
                        className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors duration-150"
                      >
                        <td className="px-8 py-4 font-mono text-sm text-neutral-600">
                          {order.order_number}
                        </td>
                        <td className="px-8 py-4 text-[15px] font-medium text-neutral-900">
                          {order.customer_name}
                        </td>
                        <td className="px-8 py-4 text-[15px] text-neutral-600">
                          {order.distributor_name}
                        </td>
                        <td className="px-8 py-4 text-right text-[15px] font-semibold text-neutral-900">
                          {formatCurrency(order.total_amount)}
                        </td>
                        <td className="px-8 py-4 text-center">
                          <Badge variant={cfg?.variant ?? 'secondary'}>
                            {cfg?.label ?? order.status}
                          </Badge>
                        </td>
                        <td className="px-8 py-4 text-sm text-neutral-500">
                          {formatDate(order.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-12 text-center text-[15px] text-neutral-400">
                        {searchQuery || statusFilter !== 'all' ? '未找到匹配的订单' : '暂无订单数据'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
