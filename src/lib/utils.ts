import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currencySymbol = 'LKR '): string {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `${currencySymbol}${validAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
