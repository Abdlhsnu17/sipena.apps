const ISO_8601_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const isIso8601DateTime = (value: unknown): value is string => {
  return typeof value === 'string' && ISO_8601_DATETIME.test(value) && !Number.isNaN(new Date(value).getTime());
};

export const isoDateTimeMessage = (label: string): string => `${label} harus berupa tanggal dan waktu yang valid.`;
