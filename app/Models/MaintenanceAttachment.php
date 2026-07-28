<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceAttachment extends Model
{
    public $timestamps = false;

    protected $fillable = ['maintenance_id', 'file_name', 'file_path', 'mime_type', 'uploaded_by', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function maintenance(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
