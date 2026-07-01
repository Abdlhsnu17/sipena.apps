import { body, param, query } from 'express-validator';

/**
 * Validation rules for authentication
 */
export const loginValidation = [
  body('nip').notEmpty().withMessage('Username atau email wajib diisi'),
  body('password').notEmpty().withMessage('Password wajib diisi')
];

export const registerValidation = [
  body('nip').notEmpty().withMessage('NIP is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match');
    }
    return true;
  })
];

/**
 * Validation rules for assets
 */
export const createAssetValidation = [
  body('name').notEmpty().withMessage('Asset name is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('type').isIn(['medical', 'non_medical']).withMessage('Type must be medical or non_medical')
];

export const updateAssetValidation = [
  param('id').isNumeric().withMessage('Valid asset ID is required'),
  body('name').optional().notEmpty().withMessage('Asset name cannot be empty'),
  body('type').optional().isIn(['medical', 'non_medical']).withMessage('Type must be medical or non_medical')
];

/**
 * Validation rules for borrowings
 */
export const createBorrowingValidation = [
  body('assetId').isNumeric().withMessage('Valid asset ID is required'),
  body('borrowDate').isISO8601().withMessage('Valid borrow date is required'),
  body('dueDate').optional().isISO8601().withMessage('Valid due date is required'),
  // field is called "purpose" in API but represents the room/tujuan peminjaman
  body('purpose').notEmpty().withMessage('Ruangan peminjaman wajib diisi')
];

/**
 * Validation rules for maintenance
 */
export const createMaintenanceValidation = [
  body('assetId').isNumeric().withMessage('Valid asset ID is required'),
  body('type').isIn(['preventive', 'corrective', 'calibration', 'inspection']).withMessage('Invalid maintenance type'),
  body('scheduledDate').isISO8601().withMessage('Valid scheduled date is required'),
  body('description').notEmpty().withMessage('Description is required')
];

/**
 * Validation rules for users
 */
export const createUserValidation = [
  body('nip').notEmpty().withMessage('NIP is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

export const updateUserValidation = [
  param('id').isNumeric().withMessage('Valid user ID is required'),
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required')
];

export const changePasswordValidation = [
  param('id').isNumeric().withMessage('Valid user ID is required'),
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
];

/**
 * Common validation rules
 */
export const idParamValidation = [
  param('id').isNumeric().withMessage('Valid ID is required')
];

export const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];
