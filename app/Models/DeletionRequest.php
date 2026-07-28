<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeletionRequest extends Model
{
    protected $fillable = [
        'request_code', 'target_type', 'target_id', 'target_label', 'reason', 'status',
        'requested_by', 'reviewed_by', 'reviewed_at', 'review_notes', 'approved_at', 'rejected_at',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
