<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetUsageLog extends Model
{
    use SoftDeletes;

    public const SOURCE_MANUAL = 'manual';
    public const SOURCE_BORROWING_SYNC = 'borrowing_sync';

    protected $fillable = [
        'no', 'borrowing_id', 'asset_id', 'asset_type', 'asset_detail_id', 'asset_detail_name', 'asset_detail_code',
        'asset_location', 'room_name', 'operator_user_id', 'usage_context', 'started_at', 'ended_at', 'usage_count',
        'condition_before', 'condition_after', 'notes', 'created_by', 'deleted_by', 'delete_reason', 'source_type',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'usage_count' => 'integer',
        ];
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function borrowing(): BelongsTo
    {
        return $this->belongsTo(BorrowingRecord::class, 'borrowing_id');
    }
}
