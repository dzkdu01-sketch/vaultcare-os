export type NavigationItem = {
  label: string
  path: string
}

export const primaryNavigation: NavigationItem[] = [
  { label: '产品', path: '/products' },
  { label: '供应商', path: '/suppliers' },
  { label: '订单', path: '/orders' },
]
