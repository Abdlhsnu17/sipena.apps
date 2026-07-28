<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenancePart extends Model
{
    public $timestamps = false;

    protected $fillable = ['maintenance_id', 'name', 'quantity', 'unit', 'unit_cost', 'created_at'];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_cost' => 'decimal:2',
            'created_at' => 'datetime',
        ];
    }

    public function maintenance(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_id');
    }
}
