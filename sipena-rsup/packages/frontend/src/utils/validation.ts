/**
 * Validation utility functions
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate NIP format
 */
export function isValidNip(nip: string): boolean {
  // NIP should be numeric and have proper length
  return /^\d{18}$/.test(nip);
}

/**
 * Validate password strength
 */
export function isStrongPassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
}

/**
 * Validate required field
 */
export function isRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Validate minimum length
 */
export function hasMinLength(value: string, minLength: number): boolean {
  return value.length >= minLength;
}

/**
 * Validate maximum length
 */
export function hasMaxLength(value: string, maxLength: number): boolean {
  return value.length <= maxLength;
}

/**
 * Validate login form
 */
export function validateLoginForm(data: { nip: string; password: string }): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isRequired(data.nip)) {
    errors.nip = 'NIP wajib diisi';
  }

  if (!isRequired(data.password)) {
    errors.password = 'Password wajib diisi';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate registration form
 */
export function validateRegisterForm(data: {
  nip: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isRequired(data.nip)) {
    errors.nip = 'NIP wajib diisi';
  }

  if (!isRequired(data.name)) {
    errors.name = 'Nama wajib diisi';
  }

  if (!isRequired(data.email)) {
    errors.email = 'Email wajib diisi';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Format email tidak valid';
  }

  if (!isRequired(data.password)) {
    errors.password = 'Password wajib diisi';
  } else if (!hasMinLength(data.password, 6)) {
    errors.password = 'Password minimal 6 karakter';
  }

  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Konfirmasi password tidak cocok';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate asset form
 */
export function validateAssetForm(data: {
  name: string;
  category: string;
  type: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isRequired(data.name)) {
    errors.name = 'Nama aset wajib diisi';
  }

  if (!isRequired(data.category)) {
    errors.category = 'Kategori wajib dipilih';
  }

  if (!isRequired(data.type)) {
    errors.type = 'Tipe aset wajib dipilih';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate borrowing form
 */
export function validateBorrowingForm(data: {
  assetId: number | string;
  borrowDate: string;
  purpose: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isRequired(data.assetId)) {
    errors.assetId = 'Aset wajib dipilih';
  }

  if (!isRequired(data.borrowDate)) {
    errors.borrowDate = 'Tanggal peminjaman wajib diisi';
  }

  if (!isRequired(data.purpose)) {
    errors.purpose = 'Ruangan peminjaman wajib diisi';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
