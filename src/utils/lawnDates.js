import { addDaysToDateString } from '../data/LawnPackData.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const UK_WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UK_WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const UK_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** @param {string | Date} date */
export function startOfDay(date) {
  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/** @param {string | Date} fromDate @param {string | Date} toDate */
export function daysBetween(fromDate, toDate) {
  const toMs = startOfDay(toDate).getTime();
  const fromMs = startOfDay(fromDate).getTime();
  return Math.floor((toMs - fromMs) / MS_PER_DAY);
}

/** @param {string} dateString */
export function formatUkDate(dateString) {
  if (!dateString) return '';
  const normalized = startOfDay(dateString);
  const day = String(normalized.getDate()).padStart(2, '0');
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const year = normalized.getFullYear();
  return `${day}/${month}/${year}`;
}

/** @param {string} input */
export function parseUkDate(input) {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return formatInputDate(date);
}

/** @param {number | null} days */
export function formatDaysSinceLabel(days) {
  if (days === null) return 'no record yet';
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** @param {Date} date */
export function formatSyncTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/** @param {string} dateString */
export function formatDisplayDate(dateString) {
  const normalized = startOfDay(dateString);
  const weekday = UK_WEEKDAYS_SHORT[normalized.getDay()];
  const month = UK_MONTHS_SHORT[normalized.getMonth()];
  return `${weekday}, ${normalized.getDate()} ${month} ${normalized.getFullYear()}`;
}

/** @param {Date} date */
export function formatInputDate(date) {
  const normalized = startOfDay(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {string | null | undefined} lastDateString
 * @param {number} daysToAdd
 */
export function formatNextDueDate(lastDateString, daysToAdd) {
  if (!lastDateString) return null;
  const dueDateStr = addDaysToDateString(lastDateString, daysToAdd);
  const dueDate = startOfDay(dueDateStr);
  const weekday = UK_WEEKDAYS_LONG[dueDate.getDay()];
  const day = String(dueDate.getDate()).padStart(2, '0');
  const month = String(dueDate.getMonth() + 1).padStart(2, '0');
  const year = dueDate.getFullYear();
  return `${weekday}, ${day}/${month}/${year}`;
}
