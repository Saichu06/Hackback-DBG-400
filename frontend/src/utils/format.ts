/**
 * Formats integer cents into formatted currency (e.g. 15000 -> $150.00 or ₹150.00)
 */
export function formatMoney(cents: number | null | undefined, currency: string = '$'): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return `${currency}0.00`;
  }
  const isNegative = cents < 0;
  const absVal = Math.abs(cents);
  const dollars = Math.floor(absVal / 100);
  const remainder = absVal % 100;
  const formattedDollars = dollars.toLocaleString('en-US');
  const formattedCents = remainder.toString().padStart(2, '0');
  const formatted = `${currency}${formattedDollars}.${formattedCents}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formats ISO date string to readable format
 */
export function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
