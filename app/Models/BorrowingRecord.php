<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class BorrowingRecord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'borrowing_code', 'asset_id', 'asset_type', 'asset_detail_id', 'asset_detail_name', 'asset_detail_code',
        'user_id', 'borrower_position', 'borrower_work_unit',
        'owner_user_id', 'owner_name', 'owner_nip', 'owner_position', 'owner_work_unit',
        'borrow_date', 'due_date', 'return_date', 'status', 'purpose', 'purpose_type', 'destination_room',
        'loan_duration_value', 'loan_duration_unit', 'quantity', 'notes',
        'approved_by', 'approved_at', 'rejected_by', 'rejected_at', 'rejection_reason',
        'return_condition', 'return_notes', 'return_validated_by', 'return_validated_at', 'returned_by',
        'overdue_days', 'sanction_status', 'sanction_notes', 'sanction_applied_at',
        'extension_count', 'last_extended_date', 'extension_notes', 'is_extension_blocked',
        'resolved_at', 'resolved_by_user_id', 'resolved_notes',
        'deleted_by', 'delete_reason',
    ];

    protected function casts(): array
    {
        return [
            'borrow_date' => 'datetime',
            'due_date' => 'datetime',
            'return_date' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'return_validated_at' => 'datetime',
            'last_extended_date' => 'datetime',
            'sanction_applied_at' => 'datetime',
            'resolved_at' => 'datetime',
            'is_extension_blocked' => 'boolean',
            'quantity' => 'integer',
            'overdue_days' => 'integer',
            'extension_count' => 'integer',
        ];
    }

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejecter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function returnValidator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'return_validated_by');
    }

    public function returner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'returned_by');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_user_id');
    }

    public function asset(): MedicalAsset|NonMedicalAsset|null
    {
        return $this->asset_type === 'medical'
            ? MedicalAsset::find($this->asset_id)
            : NonMedicalAsset::find($this->asset_id);
    }
}
