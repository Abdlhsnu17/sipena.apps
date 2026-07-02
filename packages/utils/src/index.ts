export const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const clampNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  const normalized = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(normalized, max));
};

export const isIsoDateOnly = (value: string | null | undefined): value is string => {
  const normalized = value?.trim();
  return Boolean(normalized) && /^\d{4}-\d{2}-\d{2}$/.test(normalized ?? '');
};
