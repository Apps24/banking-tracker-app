import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';

function toDate(date: string | Date): Date {
  if (typeof date === 'string') return parseISO(date);
  return date;
}

/**
 * Human-friendly date label:
 *   Today    → "Today, 3:45 PM"
 *   Yesterday → "Yesterday, 3:45 PM"
 *   This year → "Mar 7"
 *   Older    → "Mar 7, 2024"
 */
export function formatDate(date: string | Date): string {
  const d = toDate(date);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, 'h:mm a')}`;
  const currentYear = new Date().getFullYear();
  if (d.getFullYear() === currentYear) return format(d, 'MMM d');
  return format(d, 'MMM d, yyyy');
}

/**
 * Time only: "3:45 PM"
 */
export function formatTime(date: string | Date): string {
  return format(toDate(date), 'h:mm a');
}

/**
 * Relative time: "2 hours ago", "3 days ago"
 */
export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true });
}

/**
 * Month + year label: "March 2026", "Jan 2025"
 */
export function formatMonth(date: string | Date): string {
  return format(toDate(date), 'MMMM yyyy');
}

/**
 * Short month label for chart axes: "Mar", "Apr"
 */
export function formatMonthShort(date: string | Date): string {
  return format(toDate(date), 'MMM');
}

/**
 * ISO date string for API params: "2026-03-07"
 */
export function toISODate(date: string | Date): string {
  return format(toDate(date), 'yyyy-MM-dd');
}

/**
 * Start and end of a given month (for filtering transactions)
 */
export function getMonthRange(date: string | Date): { start: Date; end: Date } {
  const d = toDate(date);
  return { start: startOfMonth(d), end: endOfMonth(d) };
}
