import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '../layouts/AppShell'
import { ProtectedRoute, OperatorRoute } from '../../modules/auth/components/ProtectedRoute'
import { LoginPage } from '../../pages/auth/LoginPage'
import { ProductListPage } from '../../pages/products/ProductListPage'
import { ProductDetailPage } from '../../pages/products/ProductDetailPage'
import { ProductFormPage } from '../../pages/products/ProductFormPage'
import { CatalogBrochurePage } from '../../pages/products/CatalogBrochurePage'
import { LookbookPage } from '../../pages/lookbook/LookbookPage'
import { OrderListPage } from '../../pages/orders/OrderListPage'
import { OrderDetailPage } from '../../pages/orders/OrderDetailPage'
import { OrderFormPage } from '../../pages/orders/OrderFormPage'
import { SiteSettingsPage } from '../../pages/settings/ManagementCenterPage'
import { SupplierPage } from '../../pages/suppliers/SupplierPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/lookbook" element={<LookbookPage />} />

      {/* Protected routes */}
      <Route path="/orders" element={<ProtectedRoute><AppShell><OrderListPage /></AppShell></ProtectedRoute>} />
      <Route path="/orders/new" element={<ProtectedRoute><AppShell><OrderFormPage /></AppShell></ProtectedRoute>} />
      <Route path="/orders/:id" element={<ProtectedRoute><AppShell><OrderDetailPage /></AppShell></ProtectedRoute>} />
      <Route path="/orders/:id/edit" element={<ProtectedRoute><AppShell><OrderFormPage /></AppShell></ProtectedRoute>} />
      <Route path="/my-sites" element={<ProtectedRoute><Navigate to="/settings" replace /></ProtectedRoute>} />

      {/* Operator-only routes */}
      <Route path="/products" element={<OperatorRoute><AppShell><ProductListPage /></AppShell></OperatorRoute>} />
      <Route path="/products/catalog" element={<OperatorRoute><AppShell><CatalogBrochurePage /></AppShell></OperatorRoute>} />
      <Route path="/products/new" element={<OperatorRoute><AppShell><ProductFormPage /></AppShell></OperatorRoute>} />
      <Route path="/products/:id" element={<OperatorRoute><AppShell><ProductDetailPage /></AppShell></OperatorRoute>} />
      <Route path="/products/:id/edit" element={<OperatorRoute><AppShell><ProductFormPage /></AppShell></OperatorRoute>} />
      <Route path="/suppliers" element={<OperatorRoute><AppShell><SupplierPage /></AppShell></OperatorRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppShell><SiteSettingsPage /></AppShell></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  )
}
