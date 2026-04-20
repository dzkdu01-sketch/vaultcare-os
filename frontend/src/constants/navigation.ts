export type NavigationItem = {
  label: string
  path: string
  operatorOnly?: boolean
  distributorOnly?: boolean
}

export const primaryNavigation: NavigationItem[] = [
  { label: '订单', path: '/orders' },
  { label: '产品', path: '/products', operatorOnly: true },
  { label: '供应商', path: '/suppliers', operatorOnly: true },
]
