import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getScoreColor(score: number): string {
  if (score >= 3.0) return 'text-red-600 bg-red-50 border-red-200'
  if (score >= 2.0) return 'text-orange-600 bg-orange-50 border-orange-200'
  if (score >= 1.5) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  return 'text-gray-600 bg-gray-50 border-gray-200'
}
