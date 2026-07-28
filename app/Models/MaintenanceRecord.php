<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaintenanceRecord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'maintenance_code', 'asset_id', 'asset_type', 'asset_detail_id', 'asset_detail_name', 'asset_detail_code',
        'type', 'priority', 'status', 'scheduled_date', 'due_at', 'started_at', 'completed_date', 'description',
        'technician', 'technician_user_id', 'vendor_name', 'vendor_reference', 'warranty_until',
        'estimated_duration_minutes', 'estimated_cost', 'damage_photo_url', 'before_photo_url', 'after_photo_url',
        'diagnosis', 'action_taken', 'checklist', 'spare_parts', 'verification_result', 'final_condition',
        'verification_notes', 'next_maintenance_date', 'actual_start_at', 'actual_end_at',
        'recurrence_interval', 'recurrence_enabled', 'approval_status', 'approval_notes', 'approved_by', 'approved_at',
        'reminder_h7_sent_at', 'reminder_h3_sent_at', 'reminder_h1_sent_at', 'cost', 'notes', 'cancellation_reason',
        'created_by', 'completed_by', 'validated_by', 'validated_at', 'deleted_by', 'delete_reason',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'datetime',
            'due_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_date' => 'datetime',
            'warranty_until' => 'date',
            'next_maintenance_date' => 'date',
            'actual_start_at' => 'datetime',
            'actual_end_at' => 'datetime',
            'approved_at' => 'datetime',
            'reminder_h7_sent_at' => 'datetime',
            'reminder_h3_sent_at' => 'datetime',
            'reminder_h1_sent_at' => 'datetime',
            'validated_at' => 'datetime',
            'recurrence_enabled' => 'boolean',
            'estimated_cost' => 'decimal:2',
            'cost' => 'decimal:2',
        ];
    }

    public function technicianUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_user_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function completer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function statusLogs(): HasMany
    {
        return $this->hasMany(MaintenanceStatusLog::class, 'maintenance_id');
    }

    public function parts(): HasMany
    {
        return $this->hasMany(MaintenancePart::class, 'maintenance_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(MaintenanceAttachment::class, 'maintenance_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(MaintenanceHistory::class, 'maintenance_id');
    }
}
