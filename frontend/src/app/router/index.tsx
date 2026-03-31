import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '../layouts/AppShell'
import { ProductListPage } from '../../pages/products/ProductListPage'
import { ProductDetailPage } from '../../pages/products/ProductDetailPage'
import { ProductFormPage } from '../../pages/products/ProductFormPage'
import { CatalogBrochurePage } from '../../pages/products/CatalogBrochurePage'
import { LookbookPage } from '../../pages/lookbook/LookbookPage'
import { OrderListPage } from '../../pages/orders/OrderListPage'
import { OrderDetailPage } from '../../pages/orders/OrderDetailPage'
import { SiteSettingsPage } from '../../pages/settings/SiteSettingsPage'
import { SupplierPage } from '../../pages/suppliers/SupplierPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/lookbook" element={<LookbookPage />} />
      <Route path="/products" element={<AppShell><ProductListPage /></AppShell>} />
      <Route path="/products/catalog" element={<AppShell><CatalogBrochurePage /></AppShell>} />
      <Route path="/products/new" element={<AppShell><ProductFormPage /></AppShell>} />
      <Route path="/products/:id" element={<AppShell><ProductDetailPage /></AppShell>} />
      <Route path="/products/:id/edit" element={<AppShell><ProductFormPage /></AppShell>} />
      <Route path="/orders" element={<AppShell><OrderListPage /></AppShell>} />
      <Route path="/orders/:id" element={<AppShell><OrderDetailPage /></AppShell>} />
      <Route path="/suppliers" element={<AppShell><SupplierPage /></AppShell>} />
      <Route path="/settings" element={<AppShell><SiteSettingsPage /></AppShell>} />
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  )
}
