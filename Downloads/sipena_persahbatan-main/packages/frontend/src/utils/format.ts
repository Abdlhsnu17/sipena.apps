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

const getDateParts = (value?: string | Date | null): [number, number, number] | null => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [value.getFullYear(), value.getMonth() + 1, value.getDate()];
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const [dateSegment] = raw.split('T');
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
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!date || Number.isNaN(date.getTime())) return null;
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

const parseDateTimeValue = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date;
};

export const formatLongDateLabel = (value?: string | Date | null): string | undefined => {
  const date = parseDateTimeValue(value);
  if (!date) return undefined;
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatTimeDotsLabel = (value?: string | Date | null): string | undefined => {
  const date = parseDateTimeValue(value);
  if (!date) return undefined;
  return date
    .toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(/:/g, '.');
};
