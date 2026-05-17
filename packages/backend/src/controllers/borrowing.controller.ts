import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AssetType } from '../models';
import { BorrowingService } from '../services/borrowing.service';
import { recordUserActivity } from '../services/user_activity.service';

const getActorUserId = (req: Request): number | null => {
  const parsed = Number(req.user?.id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getBorrowingCode = (borrowing: any): string | null => {
  return borrowing?.borrowingCode ?? borrowing?.borrowing_code ?? null;
};

const normalizeAssetType = (value: unknown): AssetType | undefined => {
  if (value === 'medical' || value === 'non_medical') {
    return value;
  }

  return undefined;
};

export class BorrowingController {
  private borrowingService: BorrowingService;

  constructor() {
    this.borrowingService = new BorrowingService();
  }

  /**
   * Get all borrowings with pagination and filters
   * GET /api/borrowing
   */
  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        userId,
        assetId,
        assetType
      } = req.query;

      const result = await this.borrowingService.getAll({
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        userId: userId as string,
        assetId: assetId as string,
        assetType: normalizeAssetType(assetType)
      });

      res.json(result);
    } catch (error) {
      console.error('Get borrowings error:', error);
        if (error instanceof Error) {
          console.error('Stack:', error.stack);
        }
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : error
      });
    }
  };

  /**
   * Get borrowing by ID
   * GET /api/borrowing/:id
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.borrowingService.getById(id);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Get borrowing error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create new borrowing request
   * POST /api/borrowing
   */
  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const authUser = req.user;
      const userId = authUser && authUser.id !== undefined ? (typeof authUser.id === 'number' ? authUser.id : Number(authUser.id)) : undefined;

      if (!userId || Number.isNaN(userId)) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      // payload may come from frontend using either `purpose` or older `room` field
      const payload: any = { ...req.body, userId };
      if (!payload.purpose && payload.room) {
        // historical property name used on UI; map it
        payload.purpose = payload.room;
        delete payload.room;
      }
      if (!payload.destinationRoom && payload.room) {
        payload.destinationRoom = payload.room;
      }
      if (!payload.borrowerWorkUnit && authUser?.workUnit) {
        payload.borrowerWorkUnit = authUser.workUnit;
      }
      const result = await this.borrowingService.create(payload);
      const actorId = getActorUserId(req);
      if (actorId && result.success && result.data) {
        const borrowingCode = getBorrowingCode(result.data)
        await recordUserActivity({
          userId: actorId,
          feature: 'peminjaman_alat',
          action: 'create',
          description: `Membuat peminjaman alat ${borrowingCode ?? `#${result.data.id}`}`,
          metadata: {
            transactionId: borrowingCode ?? result.data.id,
            transaction_id: borrowingCode ?? result.data.id,
            borrowingCode: borrowingCode ?? undefined,
            borrowing_code: borrowingCode ?? undefined,
            borrowingId: result.data.id,
            assetId: result.data.assetId,
            assetCode: result.data.assetCode,
            assetName: result.data.assetName,
            status: result.data.status,
          },
        });
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Create borrowing error:', error);
        if (error instanceof Error) {
          console.error('Stack:', error.stack);
        }
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : error
      });
    }
  };

  /**
   * Update borrowing / return details (admin/leader)
   * PATCH /api/borrowing/:id
   */
  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const {
        borrowDate,
        dueDate,
        purpose,
        room,
        borrowerPosition,
        borrowerWorkUnit,
        ownerName,
        ownerPosition,
        ownerWorkUnit,
        purposeType,
        destinationRoom,
        loanDurationValue,
        loanDurationUnit,
        quantity,
        notes,
        returnCondition,
        returnNotes
      } = req.body;

      const effectivePurpose = purpose || room;
      const result = await this.borrowingService.update(id, {
        borrowDate: borrowDate ? new Date(borrowDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        purpose: effectivePurpose,
        borrowerPosition,
        borrowerWorkUnit,
        ownerName,
        ownerPosition,
        ownerWorkUnit,
        purposeType,
        destinationRoom: destinationRoom || room,
        loanDurationValue,
        loanDurationUnit,
        quantity,
        notes,
        returnCondition,
        returnNotes
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      const actorId = getActorUserId(req);
      if (actorId && result.data) {
        const borrowingCode = getBorrowingCode(result.data)
        await recordUserActivity({
          userId: actorId,
          feature: 'peminjaman_alat',
          action: 'update',
          description: `Mengubah data peminjaman ${borrowingCode ?? `#${result.data.id}`}`,
          metadata: {
            transactionId: borrowingCode ?? result.data.id,
            transaction_id: borrowingCode ?? result.data.id,
            borrowingCode: borrowingCode ?? undefined,
            borrowing_code: borrowingCode ?? undefined,
            borrowingId: result.data.id,
            assetCode: result.data.assetCode,
            assetName: result.data.assetName,
            status: result.data.status,
          },
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Update borrowing error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : error
      });
    }
  };

  /**
   * Approve borrowing request
   * PATCH /api/borrowing/:id/approve
   */
  approve = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const approvedBy = getActorUserId(req);

      if (!approvedBy) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const result = await this.borrowingService.approve(id, approvedBy);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      const actorId = getActorUserId(req);
      if (actorId && result.data) {
        const borrowingCode = getBorrowingCode(result.data)
        await recordUserActivity({
          userId: actorId,
          feature: 'peminjaman_alat',
          action: 'approve',
          description: `Menyetujui peminjaman ${borrowingCode ?? `#${result.data.id}`}`,
          metadata: {
            transactionId: borrowingCode ?? result.data.id,
            transaction_id: borrowingCode ?? result.data.id,
            borrowingCode: borrowingCode ?? undefined,
            borrowing_code: borrowingCode ?? undefined,
            borrowingId: result.data.id,
            assetCode: result.data.assetCode,
            assetName: result.data.assetName,
            status: result.data.status,
          },
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Approve borrowing error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Reject borrowing request
   * PATCH /api/borrowing/:id/reject
   */
  reject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const rejectedBy = getActorUserId(req);

      if (!rejectedBy) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const result = await this.borrowingService.reject(id, rejectedBy, reason);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      const actorId = getActorUserId(req);
      if (actorId && result.data) {
        const borrowingCode = getBorrowingCode(result.data)
        await recordUserActivity({
          userId: actorId,
          feature: 'peminjaman_alat',
          action: 'reject',
          description: `Menolak peminjaman ${borrowingCode ?? `#${result.data.id}`}`,
          metadata: {
            transactionId: borrowingCode ?? result.data.id,
            transaction_id: borrowingCode ?? result.data.id,
            borrowingCode: borrowingCode ?? undefined,
            borrowing_code: borrowingCode ?? undefined,
            borrowingId: result.data.id,
            assetCode: result.data.assetCode,
            assetName: result.data.assetName,
            status: result.data.status,
            reason,
          },
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Reject borrowing error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Return borrowed asset
   * PATCH /api/borrowing/:id/return
   */
  return = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { condition, notes } = req.body;
      const authUser = req.user;
      let returnedBy: number | undefined;

      if (authUser && authUser.id !== undefined) {
        const parsedId = typeof authUser.id === 'number' ? authUser.id : Number(authUser.id);
        if (!Number.isNaN(parsedId)) {
          returnedBy = parsedId;
        }
      }

      const result = await this.borrowingService.return(id, {
        condition,
        notes,
        returnedBy
      });

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      const actorId = getActorUserId(req);
      if (actorId && result.data) {
        const borrowingCode = getBorrowingCode(result.data)
        await recordUserActivity({
          userId: actorId,
          feature: 'pengembalian_alat',
          action: 'return',
          description: `Mengembalikan alat untuk peminjaman ${borrowingCode ?? `#${result.data.id}`}`,
          metadata: {
            transactionId: borrowingCode ?? result.data.id,
            transaction_id: borrowingCode ?? result.data.id,
            borrowingCode: borrowingCode ?? undefined,
            borrowing_code: borrowingCode ?? undefined,
            borrowingId: result.data.id,
            assetCode: result.data.assetCode,
            assetName: result.data.assetName,
            condition,
            status: result.data.status,
          },
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Return borrowing error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Validate returned asset (admin/leader)
   * PATCH /api/borrowing/:id/validate-return
   */
  validateReturn = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const validatorId = Number(req.user?.id);

      if (!validatorId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const result = await this.borrowingService.validateReturn(id, validatorId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      const actorId = getActorUserId(req);
      if (actorId && result.data) {
        const borrowingCode = getBorrowingCode(result.data)
        await recordUserActivity({
          userId: actorId,
          feature: 'pengembalian_alat',
          action: 'validate',
          description: `Memvalidasi pengembalian alat ${borrowingCode ?? `#${result.data.id}`}`,
          metadata: {
            transactionId: borrowingCode ?? result.data.id,
            transaction_id: borrowingCode ?? result.data.id,
            borrowingCode: borrowingCode ?? undefined,
            borrowing_code: borrowingCode ?? undefined,
            borrowingId: result.data.id,
            assetCode: result.data.assetCode,
            assetName: result.data.assetName,
            status: result.data.status,
          },
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Validate return error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete borrowing record
   * DELETE /api/borrowing/:id
   */
  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const beforeDelete = await this.borrowingService.getById(id);
      const result = await this.borrowingService.delete(id);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      const actorId = getActorUserId(req);
      if (actorId) {
        const borrowingCode = getBorrowingCode(beforeDelete.data)
        await recordUserActivity({
          userId: actorId,
          feature: 'peminjaman_alat',
          action: 'delete',
          description: `Menghapus data peminjaman ${borrowingCode ?? `#${id}`}`,
          metadata: {
            transactionId: borrowingCode ?? beforeDelete.data?.id ?? Number(id),
            transaction_id: borrowingCode ?? beforeDelete.data?.id ?? Number(id),
            borrowingCode: borrowingCode ?? undefined,
            borrowing_code: borrowingCode ?? undefined,
            borrowingId: beforeDelete.data?.id ? Number(beforeDelete.data.id) : Number(id),
            assetCode: beforeDelete.data?.assetCode,
            assetName: beforeDelete.data?.assetName,
          },
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Delete borrowing error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get blocking borrowings for a user (peminjaman yang menghalangi peminjaman baru)
   * GET /api/borrowing/user/:userId/blocking
   */
  getBlockingBorrowings = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const userIdNum = Number(userId);

      if (!Number.isFinite(userIdNum) || userIdNum <= 0) {
        res.status(400).json({
          success: false,
          message: 'User ID tidak valid'
        });
        return;
      }

      const result = await this.borrowingService.getBlockingBorrowings(userIdNum);
      res.json(result);
    } catch (error) {
      console.error('Get blocking borrowings error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Extend borrowing due date (perpanjangan peminjaman)
   * PATCH /api/borrowing/:id/extend
   */
  extend = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const result = await this.borrowingService.extend(id, req.body);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      const actorId = getActorUserId(req);
      if (actorId) {
        const borrowingCode = getBorrowingCode(result.data);
        await recordUserActivity({
          userId: actorId,
          feature: 'peminjaman_alat',
          action: 'extend',
          description: `Perpanjang waktu peminjaman ${borrowingCode ?? `#${id}`}`,
          metadata: {
            transactionId: borrowingCode ?? result.data?.id ?? Number(id),
            transaction_id: borrowingCode ?? result.data?.id ?? Number(id),
            borrowingCode: borrowingCode ?? undefined,
            borrowing_code: borrowingCode ?? undefined,
            borrowingId: result.data?.id ? Number(result.data.id) : Number(id),
            newDueDate: result.data?.dueDate,
            extensionCount: result.data?.extensionCount,
            assetCode: result.data?.assetCode,
            assetName: result.data?.assetName,
          },
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Extend borrowing error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}

export default new BorrowingController();
