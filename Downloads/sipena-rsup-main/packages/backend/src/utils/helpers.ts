/**
 * Convert cost number to Indonesian label (e.g. 1000 -> 'seribu rupiah')
 */
export function formatCostLabel(cost?: number): string {
  if (!cost || cost <= 0) return '-';
  if (cost === 1000) return 'seribu rupiah';
  if (cost === 100000) return 'seratus ribu rupiah';
  if (cost === 1000000) return 'satu juta rupiah';
  if (cost >= 1000000 && cost % 1000000 === 0) return `${cost / 1000000} juta rupiah`;
  if (cost >= 1000 && cost % 1000 === 0) return `${cost / 1000} ribu rupiah`;
  return `Rp${cost.toLocaleString('id-ID')}`;
}
/**
 * Generate unique asset code
 */
export function generateAssetCode(type: string): string {
  const prefix = type === 'medical' ? 'MED' : 'NMD';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate unique borrowing code
 */
export function generateBorrowingCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BRW-${timestamp}-${random}`;
}

/**
 * Generate unique maintenance code
 */
export function generateMaintenanceCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MNT-${timestamp}-${random}`;
}

/**
 * Format date to Indonesian locale
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', options || {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Convert various date/time inputs into a MySQL DATETIME string using local components.
 */
export function formatDateTimeForMySQL(value?: string | Date | null): string | null {
  if (!value) return null;

  const pad = (num: number) => String(num).padStart(2, '0');
  let year: number;
  let month: number;
  let day: number;
  let hours: number;
  let minutes: number;
  let seconds: number;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    year = value.getFullYear();
    month = value.getMonth() + 1;
    day = value.getDate();
    hours = value.getHours();
    minutes = value.getMinutes();
    seconds = value.getSeconds();
  } else {
    const raw = String(value).trim();
    if (!raw) return null;
    const matched = raw.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?.*$/
    );

    if (matched) {
      year = Number(matched[1]);
      month = Number(matched[2]);
      day = Number(matched[3]);
      hours = Number(matched[4]);
      minutes = Number(matched[5]);
      seconds = matched[6] ? Number(matched[6]) : 0;
    } else {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return null;
      year = parsed.getFullYear();
      month = parsed.getMonth() + 1;
      day = parsed.getDate();
      hours = parsed.getHours();
      minutes = parsed.getMinutes();
      seconds = parsed.getSeconds();
    }
  }

  return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format currency to Indonesian Rupiah
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Check if date is overdue
 */
export function isOverdue(dueDate?: Date | string | null): boolean {
  if (!dueDate) return false;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return new Date() > due;
}

/**
 * Sanitize string for safe database query
 */
export function sanitizeString(str: string): string {
  return str.replace(/[<>'"]/g, '');
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 10): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Paginate array
 */
export function paginate<T>(array: T[], page: number, limit: number): T[] {
  const start = (page - 1) * limit;
  return array.slice(start, start + limit);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
