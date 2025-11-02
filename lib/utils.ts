import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency conversion utilities
// SAR to USD conversion rate (approximately)
const SAR_TO_USD_RATE = 3.75;

/**
 * Convert SAR price to USD
 * @param sarPrice Price in Saudi Riyal
 * @returns Price in USD rounded to 2 decimal places
 */
export function convertSarToUsd(sarPrice: number): number {
  return Math.round((sarPrice / SAR_TO_USD_RATE) * 100) / 100;
}

/**
 * Format USD price with SAR equivalent
 * @param sarPrice Price in Saudi Riyal
 * @returns Object with USD price and SAR equivalent text
 */
export function formatPriceWithSar(sarPrice: number): { usdPrice: number; sarText: string } {
  const usdPrice = convertSarToUsd(sarPrice);
  return {
    usdPrice,
    sarText: `ما يساوي ${sarPrice} ريال سعودي`
  };
}
