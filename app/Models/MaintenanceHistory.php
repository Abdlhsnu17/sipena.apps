<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaintenanceHistory extends Model
{
    use SoftDeletes;

    protected $table = 'maintenance_history';

    protected $fillable = [
        'maintenance_id', 'asset_id', 'type', 'status', 'scheduled_date', 'started_date', 'completed_date',
        'description', 'technician', 'cost', 'notes', 'created_by', 'validated_by', 'validated_at',
        'deleted_by', 'delete_reason',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'datetime',
            'started_date' => 'datetime',
            'completed_date' => 'datetime',
            'validated_at' => 'datetime',
            'cost' => 'decimal:2',
        ];
    }

    public function maintenance(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_id');
    }
}
