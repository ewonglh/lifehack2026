function parseCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

const weekDayNames = [
  { shortLabel: 'Mon', longLabel: 'Monday' },
  { shortLabel: 'Tue', longLabel: 'Tuesday' },
  { shortLabel: 'Wed', longLabel: 'Wednesday' },
  { shortLabel: 'Thu', longLabel: 'Thursday' },
  { shortLabel: 'Fri', longLabel: 'Friday' },
  { shortLabel: 'Sat', longLabel: 'Saturday' },
  { shortLabel: 'Sun', longLabel: 'Sunday' },
];

export function getWeekDays(taskDay) {
  const date = parseCalendarDate(taskDay);
  if (!date) return [];

  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);

  return weekDayNames.map((labels, index) => {
    const day = new Date(date);
    day.setUTCDate(date.getUTCDate() + index);
    const dateValue = day.toISOString().slice(0, 10);
    return {
      date: dateValue,
      ...labels,
      isToday: dateValue === String(taskDay ?? ''),
    };
  });
}

export function getWeekRange(taskDay) {
  const days = getWeekDays(taskDay);
  if (!days.length) return null;
  return { start: days[0].date, end: days[days.length - 1].date };
}

export function getDaysInYear(taskDay) {
  const date = parseCalendarDate(taskDay);
  if (!date) return null;

  const year = date.getUTCFullYear();
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
}

export function getDayOfYear(taskDay) {
  const date = parseCalendarDate(taskDay);
  if (!date) return null;

  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - yearStart) / 86400000) + 1;
}

export function formatTaskDate(taskDay) {
  const date = parseCalendarDate(taskDay);
  if (!date) return '';

  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
  }).format(date);
}
