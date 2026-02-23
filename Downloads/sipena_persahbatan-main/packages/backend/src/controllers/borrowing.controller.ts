import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { BorrowingService } from '../services/borrowing.service';

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
        assetType: assetType as any
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

      const userId = (req as any).user?.id;
      const result = await this.borrowingService.create({
        ...req.body,
        userId
      });

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
        notes,
        returnCondition,
        returnNotes
      } = req.body;

      const result = await this.borrowingService.update(id, {
        borrowDate: borrowDate ? new Date(borrowDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        purpose,
        notes,
        returnCondition,
        returnNotes
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
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
      const approvedBy = (req as any).user?.id;

      const result = await this.borrowingService.approve(id, approvedBy);

      if (!result.success) {
        res.status(404).json(result);
        return;
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
      const rejectedBy = (req as any).user?.id;

      const result = await this.borrowingService.reject(id, rejectedBy, reason);

      if (!result.success) {
        res.status(404).json(result);
        return;
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
      const validatorId = Number((req as any).user?.id);

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
      const result = await this.borrowingService.delete(id);

      if (!result.success) {
        res.status(404).json(result);
        return;
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
}

export default new BorrowingController();
