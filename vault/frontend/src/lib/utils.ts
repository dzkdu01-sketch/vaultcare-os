import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string, currency = 'AED') {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return `${currency} ${num.toFixed(2)}`
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function showToast(message: string, type: 'default' | 'success' | 'warning' | 'error' = 'default') {
  // Simple toast using browser alert for now
  // In production, you would use a proper toast library
  console.log(`[Toast ${type}]: ${message}`)
  // Fallback to alert for critical errors
  if (type === 'error') {
    alert(message)
  }
}
