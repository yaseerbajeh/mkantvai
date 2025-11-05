/**
 * Utility functions for subscription management
 */

export type SubscriptionType = 'iptv' | 'shahid' | 'netflix' | 'package';

/**
 * Maps product code to subscription type
 */
export function getSubscriptionTypeFromProductCode(
  productCode: string | null | undefined
): SubscriptionType {
  if (!productCode) return 'iptv';

  if (productCode.startsWith('SUB-BASIC-')) {
    return 'iptv';
  } else if (productCode.startsWith('SUB-PREMIUM-')) {
    return 'netflix';
  } else if (productCode.startsWith('SUB-PACKAGE-')) {
    return 'package';
  } else if (productCode.startsWith('SUB-ANNUAL-')) {
    return 'iptv'; // Annual subscriptions are typically IPTV
  }

  return 'iptv'; // Default
}

/**
 * Maps product name to subscription type
 */
export function getSubscriptionTypeFromProductName(
  productName: string | null | undefined
): SubscriptionType {
  if (!productName) return 'iptv';

  const nameLower = productName.toLowerCase();

  if (nameLower.includes('shahid')) {
    return 'shahid';
  } else if (nameLower.includes('netflix')) {
    return 'netflix';
  } else if (nameLower.includes('iptv')) {
    return 'iptv';
  } else if (nameLower.includes('باقة') || nameLower.includes('package')) {
    return 'package';
  }

  return 'iptv'; // Default
}

/**
 * Determines subscription type from product code or name
 */
export function determineSubscriptionType(
  productCode?: string | null,
  productName?: string | null
): SubscriptionType {
  // Try product code first
  if (productCode) {
    const typeFromCode = getSubscriptionTypeFromProductCode(productCode);
    if (typeFromCode !== 'iptv' || productCode.startsWith('SUB-')) {
      return typeFromCode;
    }
  }

  // Fall back to product name
  if (productName) {
    return getSubscriptionTypeFromProductName(productName);
  }

  return 'iptv'; // Default fallback
}

/**
 * Parses duration text to number of days
 * Examples: "3 أشهر" -> 90, "1 شهر" -> 30, "6 أشهر" -> 180
 */
export function parseDurationToDays(durationText: string): number {
  if (!durationText) return 30;

  // Match months: "3 أشهر" (plural) or "1 شهر" (singular)
  // Handle both singular "شهر" and plural "أشهر"
  const monthsMatch = durationText.match(/(\d+)\s*أ?شهر/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    return months * 30; // Approximate 30 days per month
  }

  // Match days: "30 يوم" or "30 days"
  const daysMatch = durationText.match(/(\d+)\s*(يوم|days?)/i);
  if (daysMatch) {
    return parseInt(daysMatch[1], 10);
  }

  // If contains "باقة" or "package", default to 90 days
  if (durationText.toLowerCase().includes('باقة') || durationText.toLowerCase().includes('package')) {
    return 90;
  }

  // Default fallback
  return 30;
}

/**
 * Calculates expiration date from start date and duration
 */
export function calculateExpirationDate(
  startDate: Date | string,
  durationText: string
): Date {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const days = parseDurationToDays(durationText);
  const expiration = new Date(start);
  expiration.setDate(expiration.getDate() + days);
  return expiration;
}

/**
 * Formats subscription type for display
 */
export function formatSubscriptionType(type: SubscriptionType): string {
  const map: Record<SubscriptionType, string> = {
    iptv: 'IPTV',
    shahid: 'Shahid',
    netflix: 'Netflix',
    package: 'باقة',
  };
  return map[type] || type;
}

/**
 * Gets subscription type label in Arabic
 */
export function getSubscriptionTypeLabel(type: SubscriptionType): string {
  const map: Record<SubscriptionType, string> = {
    iptv: 'IPTV',
    shahid: 'شاهد',
    netflix: 'Netflix',
    package: 'باقة',
  };
  return map[type] || type;
}

