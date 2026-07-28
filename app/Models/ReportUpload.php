<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportUpload extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'filename', 'content_type', 'size_bytes', 'stored_path', 'uploaded_at',
        'notes', 'category', 'related_module', 'retention_until',
    ];

    protected function casts(): array
    {
        return [
            'uploaded_at' => 'datetime',
            'retention_until' => 'date',
            'size_bytes' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
