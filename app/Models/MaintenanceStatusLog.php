<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceStatusLog extends Model
{
    public $timestamps = false;

    protected $fillable = ['maintenance_id', 'from_status', 'to_status', 'note', 'changed_by', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function maintenance(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_id');
    }

    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
