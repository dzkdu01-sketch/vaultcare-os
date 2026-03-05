import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ProductsPage from '@/pages/ProductsPage'
import ProductDetailPage from '@/pages/ProductDetailPage'
import ProductManagementLayout from '@/pages/ProductManagementLayout'
import ProductEntryPage from '@/pages/ProductEntryPage'
import ProductTagsPage from '@/pages/ProductTagsPage'
import ProductCategoriesPage from '@/pages/ProductCategoriesPage'
import OrdersPage from '@/pages/OrdersPage'
import DistributorsPage from '@/pages/DistributorsPage'
import DistributorSelectionPage from '@/pages/DistributorSelectionPage'
import SuppliersPage from '@/pages/SuppliersPage'
import WPSitesPage from '@/pages/WPSitesPage'
import FinancePage from '@/pages/FinancePage'
import ImportBatchesPage from '@/pages/ImportBatchesPage'
import SettingsPage from '@/pages/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductManagementLayout />}>
            <Route index element={<Navigate to="workbench" replace />} />
            <Route path="workbench" element={<ProductsPage />} />
            <Route path="entry" element={<ProductEntryPage />} />
            <Route path="batch" element={<ImportBatchesPage />} />
            <Route path="tags" element={<ProductTagsPage />} />
            <Route path="categories" element={<ProductCategoriesPage />} />
            <Route path=":id" element={<ProductDetailPage />} />
          </Route>
          {/* 兼容旧路由，统一重定向到新录入页面 */}
          <Route path="products/new" element={<Navigate to="/products/entry" replace />} />
          <Route path="products/new-manual" element={<Navigate to="/products/entry" replace />} />
          <Route path="products/new-ai" element={<Navigate to="/products/entry" replace />} />
          <Route path="products/entry/manual" element={<Navigate to="/products/entry" replace />} />
          <Route path="products/entry/ai" element={<Navigate to="/products/entry" replace />} />
          <Route path="import-batches" element={<Navigate to="/products/batch" replace />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="distributors" element={<DistributorsPage />} />
          <Route path="distributor-selections" element={<DistributorSelectionPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="dictionaries" element={<Navigate to="/products/tags" replace />} />
          <Route path="wp-sites" element={<WPSitesPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="settings/ai" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
