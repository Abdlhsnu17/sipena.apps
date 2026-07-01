// Fungsi utilitas untuk format biaya ke label bahasa Indonesia
export function formatCostLabel(cost?: number): string {
  if (!cost || cost <= 0) return '-';
  if (cost === 1000) return 'seribu rupiah';
  if (cost === 100000) return 'seratus ribu rupiah';
  if (cost === 1000000) return 'satu juta rupiah';
  if (cost >= 1000000 && cost % 1000000 === 0) return `${cost / 1000000} juta rupiah`;
  if (cost >= 1000 && cost % 1000 === 0) return `${cost / 1000} ribu rupiah`;
  return `Rp${cost.toLocaleString('id-ID')}`;
}

export const parseServerDateTimeValue = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, 'T');
  const isoMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i
  );

  if (!isoMatch) {
    const fallback = new Date(normalized);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, year, month, day, hour, minute, second = "0", offset] = isoMatch;
  if (offset) {
    const withOffset = new Date(normalized);
    return Number.isNaN(withOffset.getTime()) ? null : withOffset;
  }

  const localDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  return Number.isNaN(localDate.getTime()) ? null : localDate;
};

const getDateParts = (value?: string | Date | null): [number, number, number] | null => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [value.getFullYear(), value.getMonth() + 1, value.getDate()];
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const normalizedRaw = raw.replace(/\s+/g, "T");
  const [dateSegment] = normalizedRaw.split('T');
  const [year, month, day] = dateSegment.split('-');
  if (!year || !month || !day) return null;
  const parsedMonth = Number(month);
  const parsedDay = Number(day);
  const parsedYear = Number(year);
  if (Number.isNaN(parsedYear) || Number.isNaN(parsedMonth) || Number.isNaN(parsedDay)) {
    return null;
  }
  return [parsedYear, parsedMonth, parsedDay];
};

export const toDateOnlyString = (value?: string | Date | null): string | undefined => {
  const parts = getDateParts(value);
  if (!parts) return undefined;
  const [year, month, day] = parts;
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');
  return `${year}-${paddedMonth}-${paddedDay}`;
};

export const toLocalDateTimeString = (value?: string | Date | null): string | undefined => {
  const date = parseServerDateTimeValue(value);
  if (!date) return undefined;
  const pad = (num: number) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

export const parseDateValue = (value?: string | Date | null): Date | null => {
  const parts = getDateParts(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
};

export const formatDateId = (value?: string | Date | null): string => {
  const date = parseDateValue(value);
  return date ? date.toLocaleDateString('id-ID') : '-';
};

export const formatBracketedDateTime = (value?: string | Date | null): string | null => {
  if (!value) return null;
  const date = parseServerDateTimeValue(value);
  if (!date) return null;
  const dateLabel = date.toLocaleDateString('id-ID');
  const timeLabel = date
    .toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(/:/g, '.');
  return `[${dateLabel}]-[${timeLabel}]`;
};

export const formatLongDateLabel = (value?: string | Date | null): string | undefined => {
  const date = parseServerDateTimeValue(value);
  if (!date) return undefined;
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatTimeDotsLabel = (value?: string | Date | null): string | undefined => {
  const date = parseServerDateTimeValue(value);
  if (!date) return undefined;
  return date
    .toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(/:/g, '.');
};

export const formatDayTimeLabel = (
  value?: string | Date | null,
  options?: { showWeekday?: boolean }
): string => {
  if (!value) return '-';
  const date = parseServerDateTimeValue(value);
  if (!date) return '-';

  const includeWeekday = options?.showWeekday ?? true;
  const dateLabel = date.toLocaleDateString('id-ID', {
    weekday: includeWeekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeLabel = date
    .toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(/:/g, '.');

  return `${dateLabel}, ${timeLabel}`;
};
